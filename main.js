document.addEventListener("DOMContentLoaded", () => {
  const profileIcon = document.querySelector(".profile-icon");
  const popup = document.getElementById("centerPopup");
  const popupProfile = document.querySelector(".popup-profile"); // ✅ 팝업 안 아이콘
  const input = document.getElementById("userNameInput");
  const saveBtn = document.getElementById("saveBtn");
  const cancelBtn = document.getElementById("cancelBtn");

  // ✅ 저장된 이름 불러오기
  const savedName = localStorage.getItem("userName");
  if (savedName) {
    profileIcon.textContent = savedName[0];
    popupProfile.textContent = savedName[0];
  } else {
    profileIcon.textContent = "👤";
    popupProfile.textContent = "👤";
  }

  // 👤 프로필 클릭 → 팝업 열기
  profileIcon.addEventListener("click", () => {
    popup.classList.remove("hidden");
    input.value = localStorage.getItem("userName") || "";
    input.focus();
  });

  // ✅ 이름 저장 / 삭제 로직
  saveBtn.addEventListener("click", () => {
    const name = input.value.trim();
    if (name) {
      localStorage.setItem("userName", name);
      profileIcon.textContent = name[0];
      popupProfile.textContent = name[0];
    } else {
      localStorage.removeItem("userName");
      profileIcon.textContent = "👤";
      popupProfile.textContent = "👤";
      input.value = "";
    }
    popup.classList.add("hidden");
  });

  // ❌ Cancel → 닫기
  cancelBtn.addEventListener("click", () => popup.classList.add("hidden"));

  // 배경 클릭 시 닫기
  popup.addEventListener("click", (e) => {
    if (e.target === popup) popup.classList.add("hidden");
  });

  // 🔹 페이지 이동 (기존 유지)
  const startButton = document.querySelector(".main-button");
  const reportButton = document.querySelector(".report-button");
  const settingsButton = document.querySelector(".settings-button");

  const navigateTo = (url) => {
    document.body.classList.add("fade-out");
    setTimeout(() => (location.href = url), 400);
  };

  if (startButton) startButton.addEventListener("click", () => navigateTo("posture.html"));
  if (reportButton) reportButton.addEventListener("click", () => navigateTo("report.html"));
  if (settingsButton) settingsButton.addEventListener("click", () => navigateTo("setup.html"));
});

document.addEventListener("DOMContentLoaded", () => {
  const settingsBtn = document.getElementById("settingsBtn");
  const aiBtn = document.querySelector(".main-button");

  // ✅ AI 모니터링 버튼 클릭 시 페이드 후 이동
  if (aiBtn) {
    aiBtn.addEventListener("click", (e) => {
      e.preventDefault();
      document.body.classList.add("fade-out");
      setTimeout(() => {
        window.location.href = "posture.html";
      }, 400);
    });
  }

  // ✅ 설정 버튼 클릭 시 페이드 후 이동
  if (settingsBtn) {
    settingsBtn.addEventListener("click", (e) => {
      e.preventDefault();
      document.body.classList.add("fade-out");
      setTimeout(() => {
        window.location.href = "settings.html";
      }, 400);
    });
  }
});
