// ==================== Webcam Setup ====================
const video = document.getElementById("video");
const canvas = document.getElementById("output");
const ctx = canvas.getContext("2d");
const feedback = document.getElementById("feedback-box");

// ✅ 1️⃣ visualizer.js 불러오기
import { Visualizer } from "./visualizer.js";

// ==================== Debouncing Variables for False Positive Prevention ====================
const REQUIRED_DURATION_MS = 1000; // 잘못된 자세가 지속되어야 하는 최소 시간 (1초)
const ISSUE_DURATION_THRESHOLD = 4000; // 동일 경고 간 최소 간격 (4초)
let badPostureStartTime = 0;
let lastIssueTime = 0;
let lastIssue = ""; // 마지막으로 경고한 문제 문구
let isWarningActive = false;
let isSpeaking = false; // 🔊 음성 피드백 중 여부

async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480 },
    audio: false
  });
  video.srcObject = stream;

  return new Promise((resolve) => {
    video.onloadedmetadata = () => {
      video.play();
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      resolve(video);
    };
  });
}

// ==================== Load MoveNet ====================
let detector;
async function loadModel() {
  // 로컬 모델 경로가 있다고 가정하고, 필요에 따라 수정하세요.
  const detectorConfig = { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING };
  // const LOCAL_MODEL_URL = './movenet_lightning/model.json';
  // const detectorConfig = { modelUrl: LOCAL_MODEL_URL };

  detector = await poseDetection.createDetector(
    poseDetection.SupportedModels.MoveNet,
    detectorConfig
  );
  console.log("✅ MoveNet model loaded!");
}

// ==================== Draw Keypoints ====================
function drawKeypoints(keypoints) {
  // 🎥 거울 모드 반전된 영상 표시
  ctx.save();
  ctx.scale(-1, 1); // 좌우 반전
  ctx.translate(-canvas.width, 0); // 반전 후 좌표 보정
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  ctx.restore();

  // 🔴 키포인트 표시 (반전된 영상에 맞게 x 좌표 반전)
  keypoints.forEach((kp) => {
    if (kp.score > 0.4) {
      const x = canvas.width - kp.x * (canvas.width / video.videoWidth);
      const y = kp.y * (canvas.height / video.videoHeight);

      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = "red";
      ctx.fill();
    }
  });
}

// ==================== 사용자 설정값 불러오기 ====================
const userSettings = {
  voiceFeedback:
    localStorage.getItem("voiceFeedback") === null
      ? true // ✅ 기본값: 음성 피드백 ON
      : localStorage.getItem("voiceFeedback") === "true",
  selectedPostures:
    JSON.parse(localStorage.getItem("selectedPostures"))?.length > 0
      ? JSON.parse(localStorage.getItem("selectedPostures"))
      : ["neck", "shoulder", "tilt", "rotation", "distance"], // ✅ 기본값: 전부 감지
};

// ==================== Posture Analysis (앉은 자세용) ====================
// 📘 인체공학적 기준 참고:
//
// - 거북목 (Forward Head Posture, FHP):
//   Craniovertebral Angle(CVA)이 50° 미만일 때 전방머리자세로 간주됨.
//   (Kendall FP et al., 2005; Yip CH et al., 2008)
//   👉 코가 어깨 중심보다 과도하게 전방 이동 시 거북목 경향으로 감지.
//
// - 어깨 비대칭:
//   어깨 높이 차이가 약 1.5 cm 이상일 경우 근긴장 불균형으로 간주.
//   (Iunes DH et al., *Clinics (Sao Paulo)*, 2009)
//
// - 머리 기울기 (Head Tilt):
//   좌우 눈 높이 차가 5~10° 초과 시 편측 근긴장 발생 가능.
//   (Lee MY et al., *J. Phys. Ther. Sci.*, 2017)
//
// - 상체 회전 (Trunk Rotation):
//   체간 회전 각도 약 15° 이상 시 불균형 자세로 분류됨.
//   (Czaprowski D et al., *J. Phys. Ther. Sci.*, 2014; Lee JH et al., *Applied Ergonomics*, 2020)
//   👉 코-어깨 중심선의 좌우 오프셋이 40px 이상일 때 회전 자세로 감지.
//
// - 화면 거리 (Viewing Distance):
//   모니터와 사용자 눈 사이의 권장 거리는 40~75 cm.
//   (OSHA Ergonomics Guidelines, 2023; ISO 9241-5)

// <정리>
// MoveNet이 검출한 신체 좌표(코, 눈, 어깨) 를 활용하여,
// 인체공학 및 물리치료 관련 논문에서 제시된 잘못된 자세 지표들을
// 코드 기반 규칙으로 정의했습니다.
// 각 조건은 해상도에 따른 스케일 보정을 적용한 2D 영상 환경에서,
// 실제 인체공학적 기준(예: 각도·거리)을 근사화하여 구현하였습니다.

function checkPosture(keypoints) {
  const nose = keypoints.find(k => k.name === "nose");
  const leftEye = keypoints.find(k => k.name === "left_eye");
  const rightEye = keypoints.find(k => k.name === "right_eye");
  const leftShoulder = keypoints.find(k => k.name === "left_shoulder");
  const rightShoulder = keypoints.find(k => k.name === "right_shoulder");

  let issues = [];

  // 1️⃣ 거북목 감지 (해상도 스케일 보정 포함)
  if (userSettings.selectedPostures.includes("neck") && nose && leftShoulder && rightShoulder) {
    const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
    const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;

    const dx = nose.x - shoulderMidX;
    const dy = shoulderMidY - nose.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const scaleFactor = canvas.width / 640;

    // 📏 인체공학 기준: CVA 50° 미만 시 FHP (Kendall et al., 2005)
    // 👉 코가 어깨 중심보다 전방 이동하거나 거리 감소 시 FHP 경향
    //    단, 화면 거리 감지 구간(아주 가까운 거리 <55)은 제외
    if ((Math.abs(dx) > 40 * scaleFactor || distance < 70 * scaleFactor) && distance >= 55 * scaleFactor) {
      issues.push("턱을 살짝 당겨주세요");
    }
  }

  // 2️⃣ 어깨 비대칭 감지
  if (userSettings.selectedPostures.includes("shoulder") && leftShoulder && rightShoulder) {
    const diffY = Math.abs(leftShoulder.y - rightShoulder.y);
    if (diffY > 20) {
      issues.push("좌우 어깨 균형이 맞지 않아요");
    }
  }

  // 3️⃣ 머리 기울기 (좌/우 치우침)
  if (userSettings.selectedPostures.includes("tilt") && leftEye && rightEye) {
    const diffY = leftEye.y - rightEye.y;
    if (Math.abs(diffY) > 10) {
      const direction = diffY > 0 ? "왼쪽" : "오른쪽";
      issues.push(`머리가 ${direction}으로 기울어졌어요`);
    }
  }

  // 4️⃣ 상체 회전 감지 (모니터 정면 유지)
  if (userSettings.selectedPostures.includes("rotation") && nose && leftShoulder && rightShoulder) {
    const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
    const diffX = nose.x - shoulderMidX;

    if (Math.abs(diffX) > 40) {
      const direction = diffX > 0 ? "왼쪽" : "오른쪽";
      issues.push(`몸이 ${direction}으로 돌아갔어요`);
    }
  }

  // 5️⃣ 화면 거리 감지 (너무 가까움)
  if (userSettings.selectedPostures.includes("distance") && nose && leftShoulder && rightShoulder) {
    const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
    const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
    const dx = nose.x - shoulderMidX;
    const dy = nose.y - shoulderMidY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // 📏 해상도 보정 (기본 640 기준)
    const scaleFactor = canvas.width / 640;

    // 약 35cm 이하 거리 (근시 유발 구간)
    // ⚠️ 단, 이미 거북목(FHP)이 감지된 경우엔 거리 경고를 생략
    if (distance < 53 * scaleFactor && !issues.includes("턱을 살짝 당겨주세요")) {
      issues.push("화면에 너무 가까이 있습니다");
    }
  }

  return issues; // 이제 배열로 반환
}

// ==================== TTS ====================
function speak() {
  // 더 이상 사용하지 않음 (Main Loop에서 직접 처리)
  //“Main Loop 내부에서 직접 TTS 제어 + 상태 관리”
  // => 타이밍 정확, 중복 방지, 코드 단순, UX 안정.
}


// ==================== Main Loop ====================
let isFHPActive = false; // ✅ 거북목 상태 유지용 (Forward Head Posture)
let lastFHPTime = 0;     // 최근 거북목 감지 시각

async function run() {
  await setupCamera();
  await loadModel();

  // ✅ 2️⃣ Visualizer 인스턴스 생성
  const visualizer = new Visualizer(canvas, video);

  // ✅ 안정 루프 & NaN 방지 버전 detectPose
  async function detectPose() {
    try {
      const poses = await detector.estimatePoses(video, { maxPoses: 1, flipHorizontal: true });

      if (poses.length > 0) {
        const keypoints = poses[0].keypoints;
        const issues = checkPosture(keypoints);

        // ✅ 거북목 상태 유지 로직 (최근 1.5초 내 감지되면 활성 상태로 간주)
        const currentTime = Date.now();
        if (issues.includes("턱을 살짝 당겨주세요")) {
          isFHPActive = true;
          lastFHPTime = currentTime;
        } else if (isFHPActive && currentTime - lastFHPTime > 1500) {
          isFHPActive = false;
        }

        // ✅ 거북목 상태일 때 '화면 가까움' 경고 제거
        if (isFHPActive) {
          const filtered = issues.filter(msg => msg !== "화면에 너무 가까이 있습니다");
          issues.length = 0;
          issues.push(...filtered);
        }

        // 🔒 NaN 방지: 영상 준비되지 않은 상태면 draw 생략
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          visualizer.draw(keypoints, issues);
        }

        //const currentTime = Date.now();

        if (issues.length > 0) {
          const ISSUE_PRIORITY = [ 
            "머리가 왼쪽으로 기울어졌어요",
            "머리가 오른쪽으로 기울어졌어요",
            "몸이 왼쪽으로 돌아갔어요",
            "몸이 오른쪽으로 돌아갔어요",
            "턱을 살짝 당겨주세요",
            "화면에 너무 가까이 있습니다",
            "좌우 어깨 균형이 맞지 않아요"
          ];

          const topIssue = ISSUE_PRIORITY.find(msg => issues.includes(msg)) || issues[0];

          if (badPostureStartTime === 0) {
            badPostureStartTime = currentTime;
          }

          const elapsed = currentTime - badPostureStartTime;

          if (elapsed >= REQUIRED_DURATION_MS) {
            if (!isSpeaking && (topIssue !== lastIssue || currentTime - lastIssueTime > ISSUE_DURATION_THRESHOLD)) {
              feedback.innerText = topIssue;
              feedback.style.color = "red";

              // ✅ 음성 피드백 설정 반영
              if (userSettings.voiceFeedback) {
                window.speechSynthesis.cancel();
                const msg = new SpeechSynthesisUtterance(topIssue);
                msg.lang = "ko-KR";
                msg.rate = 1.0;

                isSpeaking = true;
                isWarningActive = true;

                msg.onend = () => {
                  isSpeaking = false;
                  isWarningActive = false;
                };

                window.speechSynthesis.speak(msg);
              }

              lastIssue = topIssue;
              lastIssueTime = currentTime;
            }
          } else {
            feedback.innerText = `자세 흐트러짐 감지... (${Math.floor((REQUIRED_DURATION_MS - elapsed) / 100) / 10}초 남음)`;
            feedback.style.color = "orange";
          }
        } else {
          //feedback.innerText = "좋은 자세 유지 중 👍";
          feedback.innerText = "좋은 자세 유지 중 😊";
          feedback.style.color = "green";
          badPostureStartTime = 0;
          isWarningActive = false;
        }
      } else {
        // 🧍 사용자 인식 안 됨: 캔버스에 안내 표시
        // const ctx = canvas.getContext("2d");
        // ctx.clearRect(0, 0, canvas.width, canvas.height);
        // ctx.font = "20px 'Segoe UI', sans-serif";
        // ctx.fillStyle = "rgba(255,255,255,0.8)";
        // ctx.textAlign = "center";
        // ctx.fillText("🧍 사용자를 인식 중...", canvas.width / 2, canvas.height / 2);
      }
    } catch (err) {
      console.error("detectPose error:", err);
    }

    // 🔁 반드시 반복 호출 (끊김 방지)
    requestAnimationFrame(detectPose);
  }

  detectPose();
}

run();
