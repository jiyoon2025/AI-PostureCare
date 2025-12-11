document.addEventListener("DOMContentLoaded", () => {
  const voiceToggle = document.getElementById("voiceFeedback");
  const postureCheckboxes = document.querySelectorAll(".posture-options input[type='checkbox']");

  // 🔹 기본값 정의
  const DEFAULT_POSTURES = ["neck", "shoulder", "tilt", "rotation", "distance"];

  // 🔹 저장된 설정 불러오기
  let savedVoice = localStorage.getItem("voiceFeedback");
  let savedPostures = JSON.parse(localStorage.getItem("selectedPostures"));

  // ✅ 음성 피드백 기본값 = true
  if (savedVoice === null) {
    savedVoice = "true";
    localStorage.setItem("voiceFeedback", "true");
  }

  // ✅ 감지할 자세 기본값 = 모두 선택
  if (!savedPostures || savedPostures.length === 0) {
    savedPostures = DEFAULT_POSTURES;
    localStorage.setItem("selectedPostures", JSON.stringify(DEFAULT_POSTURES));
  }

  // UI 반영
  voiceToggle.checked = savedVoice === "true";
  postureCheckboxes.forEach(box => {
    box.checked = savedPostures.includes(box.value);
  });

  // 🔹 음성 피드백 변경 시 저장
  voiceToggle.addEventListener("change", () => {
    localStorage.setItem("voiceFeedback", voiceToggle.checked);
  });

  // 🔹 감지할 자세 변경 시 저장
  postureCheckboxes.forEach(box => {
    box.addEventListener("change", () => {
      const selected = Array.from(postureCheckboxes)
        .filter(b => b.checked)
        .map(b => b.value);
      localStorage.setItem("selectedPostures", JSON.stringify(selected));
    });
  });

  // 🔙 뒤로가기
  document.getElementById("backBtn").addEventListener("click", () => {
    window.location.href = "index.html";
  });
});
