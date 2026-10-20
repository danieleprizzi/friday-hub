/* Ponte di Friday: parla con la funzione privata "friday" su Supabase.
   Il codice segreto NON sta in questo file: si salva una volta sola sul telefono (localStorage). */
(function(){
  var BASE="https://zojwdncxlcqzkzqyojye.supabase.co/functions/v1/friday/";
  var LS="friday_codice";
  /* Cervello (Supabase, funzione "friday-cervello"): indirizzo e chiave sul telefono. L'indirizzo si puo cambiare (es. Mini-PC) senza toccare il codice. */
  var CERVELLO="https://zojwdncxlcqzkzqyojye.supabase.co/functions/v1/friday-cervello";
  var LSK="friday_cervello_token", LSU="friday_cervello_url";

  /* primo avvio: il codice puo arrivare nell'indirizzo (#c=... e/o #k=...), viene salvato e tolto dalla barra */
  try{
    var h=location.hash||"";
    var m=/[#&]c=([A-Za-z0-9_-]+)/.exec(h);
    var k=/[#&]k=([^&]+)/.exec(h);
    if(m) localStorage.setItem(LS,m[1]);
    if(k) localStorage.setItem(LSK,decodeURIComponent(k[1]));
    if(m||k) history.replaceState(null,"",location.pathname+location.search);
  }catch(_){}

  function codice(){
    var c=""; try{ c=localStorage.getItem(LS)||""; }catch(_){}
    return c;
  }

  async function call(name,args){
    var c=codice();
    if(!c){ throw {code:"no_code",message:"Manca il codice di Friday su questo telefono."}; }
    var r=await fetch(BASE+c,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({jsonrpc:"2.0",id:Date.now(),method:"tools/call",params:{name:name,arguments:args||{}}})
    });
    if(!r.ok) throw {code:"http_"+r.status,message:"Errore "+r.status};
    var j=await r.json();
    var res=j&&j.result||{};
    if(res.isError) throw {code:"tool",message:(res.content&&res.content[0]&&res.content[0].text)||"errore"};
    var out=res.structuredContent;
    if(out===undefined&&res.content&&res.content[0]) out=JSON.parse(res.content[0].text);
    return {payload:out};
  }

  /* Stessa forma del connettore di claude.ai, cosi il resto della pagina non cambia */
  var mcp={
    callTool:function(server,tool,args){
      if(server==="Google Docs") return Promise.reject({code:"not_available",message:"Google Docs non disponibile in questa app"});
      return call(tool,args);
    },
    watchTool:function(server,tool,args,cb,opts){
      var ms=(opts&&opts.refetchInterval)||30000;
      function tick(){ if(document.hidden) return; call(tool,args||{}).then(function(r){ cb({type:"data",result:r}); }).catch(function(){}); }
      tick(); setInterval(tick,ms);
    }
  };
  window.claude={use:function(k){ return k==="mcp"?Promise.resolve(mcp):Promise.reject(new Error("non disponibile")); }};
  /* Cervello di Friday: se sul telefono c'e la chiave, prova prima lui. Se non risponde, torna null e si usa la strada di prima. */
  function ls(k){ try{ return localStorage.getItem(k)||""; }catch(_){ return ""; } }
  async function cervello(domanda){
    var k=ls(LSK); if(!k) return null;
    var url=ls(LSU); if(!/^https:\/\//.test(url)) url=CERVELLO;
    var ac=new AbortController(), t=setTimeout(function(){ ac.abort(); },100000);
    try{
      var r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+k},body:JSON.stringify({domanda:domanda}),signal:ac.signal});
      if(!r.ok) return null;
      var j=await r.json();
      var txt=j&&j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content;
      return txt?{risposta:String(txt),cervello:true,friday:j.friday||null}:null;
    }catch(_){ return null; }
    finally{ clearTimeout(t); }
  }
  /* Gemini risponde a tutto (fuori da claude.ai Claude non c'e) */
  async function libero(domanda){
    var v=await cervello(domanda); if(v) return v;
    var c=codice(); if(!c) return {errore:"Manca il codice di Friday su questo telefono."};
    var r=await fetch(BASE.replace("/friday/","/friday-libero/")+c,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({domanda:domanda})});
    if(!r.ok) return {errore:"Errore "+r.status};
    return await r.json();
  }
  window.FridayBridge={call:call,libero:libero,haCodice:function(){ return !!codice(); },haCervello:function(){ return !!ls(LSK); }};
})();
