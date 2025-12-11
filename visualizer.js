// ==================== visualizer.js ====================
// SF 스타일 자세 피드백 시각화 엔진
// (app.js와 완전 독립, keypoints & issues 기반으로 자동 반응)

export class Visualizer {
  constructor(canvas, video) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.video = video;
    this.frameCount = 0;
  }

  draw(keypoints, issues = []) {
    const ctx = this.ctx;
    const { canvas, video } = this;
    this.frameCount++;

    // === 1️⃣ 비디오 출력 (거울 모드)
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    // === 2️⃣ 상태별 기본 색상 (깜빡임 제거)
    const hasIssue = issues.length > 0;
    const color = hasIssue
      ? `rgba(255, 120, 120, 0.95)`   // 🔴 기본 경고 색
      : `rgba(0, 255, 180, 1)`;       // 🟢 기본 좋은 자세 색
    const baseColor = color;

    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.shadowBlur = hasIssue ? 25 : 18;
    ctx.shadowColor = color;
    ctx.lineWidth = hasIssue ? 4 : 2;

    // === 3️⃣ 키포인트 편의 접근
    const find = (name) => keypoints.find(k => k.name === name && k.score > 0.4);
    const nose = find("nose");
    const leftEye = find("left_eye");
    const rightEye = find("right_eye");
    const leftShoulder = find("left_shoulder");
    const rightShoulder = find("right_shoulder");
    const leftHip = find("left_hip");
    const rightHip = find("right_hip");

    // === 🔹 어깨 균형선
    if (leftShoulder && rightShoulder) {
      const lx = canvas.width - leftShoulder.x;
      const rx = canvas.width - rightShoulder.x;
      const diffY = Math.abs(leftShoulder.y - rightShoulder.y);
      const shoulderColor = issues.some(i => i.includes("어깨"))
        ? "rgba(255,80,80,0.95)" // 🔴 항상 빨간색
        : "rgba(100,255,200,0.8)";
      ctx.beginPath();
      ctx.moveTo(lx, leftShoulder.y);
      ctx.lineTo(rx, rightShoulder.y);
      ctx.strokeStyle = shoulderColor;
      ctx.lineWidth = diffY > 20 ? 4 : 2.5;
      ctx.shadowBlur = 20;
      ctx.shadowColor = shoulderColor;
      ctx.stroke();
    }

    // === 🔹 머리 기울기선 (눈–눈)
    if (leftEye && rightEye) {
      const lx = canvas.width - leftEye.x;
      const rx = canvas.width - rightEye.x;
      const diffY = Math.abs(leftEye.y - rightEye.y);
      const headColor = issues.some(i => i.includes("머리"))
        ? "rgba(255,80,80,0.95)"   // 🔴 항상 빨간색
        : "rgba(120,255,220,0.85)";
      ctx.beginPath();
      ctx.moveTo(lx, leftEye.y);
      ctx.lineTo(rx, rightEye.y);
      ctx.strokeStyle = headColor;
      ctx.lineWidth = diffY > 10 ? 4 : 2;
      ctx.shadowColor = headColor;
      ctx.stroke();
    }

    // === 🔹 거북목 / 상체 회전 라인 (코–어깨 중심)
    if (nose && leftShoulder && rightShoulder) {
      const midX = (leftShoulder.x + rightShoulder.x) / 2;
      const midY = (leftShoulder.y + rightShoulder.y) / 2;
      const nx = canvas.width - nose.x;
      const sx = canvas.width - midX;

      const neckColor = issues.some(i => i.includes("턱") || i.includes("앞으로") || i.includes("돌아"))
        ? "rgba(255,80,80,0.95)"   // 🔴 항상 빨간색
        : "rgba(120,255,200,0.85)";

      const gradient = ctx.createLinearGradient(nx, nose.y, sx, midY);
      gradient.addColorStop(0, neckColor);
      gradient.addColorStop(1, "rgba(255,255,255,0.2)");

      ctx.beginPath();
      ctx.moveTo(nx, nose.y);
      ctx.lineTo(sx, midY);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 3.5;
      ctx.shadowBlur = 20;
      ctx.shadowColor = neckColor;
      ctx.stroke();
    }

    // === 🔹 거리(화면 너무 가까움) — 중심 Glow 효과
    if (issues.some(i => i.includes("화면에 너무 가까이"))) {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 100);
      gradient.addColorStop(0, "rgba(255,80,80,0.25)");
      gradient.addColorStop(1, "transparent");

      ctx.beginPath();
      ctx.fillStyle = gradient;
      ctx.arc(centerX, centerY, 100, 0, Math.PI * 2);
      ctx.fill();
    }

    // === 4️⃣ Glow 포인트 (각 키포인트)
    keypoints.forEach(kp => {
      if (
        kp.score > 0.4 &&
        kp.name !== "left_ear" &&
        kp.name !== "right_ear"
      ) {
        const x = canvas.width - kp.x * (canvas.width / video.videoWidth);
        const y = kp.y * (canvas.height / video.videoHeight);
        const radius = 6;

        // 🔍 문제 부위만 빨간색
        let pointColor = "rgba(0,255,180,1)"; // 기본 초록
        if (
          // 턱 / 거북목
          (issues.some(i => i.includes("턱") || i.includes("앞으로")) && kp.name === "nose") ||

          // 어깨 비대칭
          (issues.some(i => i.includes("어깨")) && (kp.name === "left_shoulder" || kp.name === "right_shoulder")) ||

          // 머리 기울기
          (issues.some(i => i.includes("머리")) && (kp.name === "left_eye" || kp.name === "right_eye")) ||

          // 상체 회전 (몸이 왼쪽/오른쪽으로 돌아갔어요)
          (issues.some(i => i.includes("몸")) &&
            (kp.name === "nose" || kp.name === "left_shoulder" || kp.name === "right_shoulder")) ||

          // 화면 가까움
          (issues.some(i => i.includes("화면")) && kp.name === "nose")
        ){
          pointColor = "rgba(255,80,80,0.95)"; // 🔴 관련 문제 좌표만 빨간색
        }

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 2);
        gradient.addColorStop(0, pointColor);
        gradient.addColorStop(1, "transparent");

        ctx.beginPath();
        ctx.fillStyle = gradient;
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // === 5️⃣ 상태 텍스트
    ctx.font = "bold 20px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = hasIssue
      ? "rgba(255,80,80,1)"
      : "rgba(0,200,110,1)";
    ctx.shadowBlur = 12;
    ctx.shadowColor = ctx.fillStyle;
    const text = hasIssue ? "⚠ BAD POSTURE" : "✅ GOOD POSTURE";
    ctx.fillText(text, canvas.width / 2, 30);

    ctx.shadowBlur = 0;
  }
}
