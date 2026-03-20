import { useState, useEffect, useCallback, useRef } from "react";
import {
  buildInviteLink,
  createRoomCode,
  createRoomSession,
  getRoomCodeFromLocation,
  hasOnlineConfig,
  normalizeRoomCode,
  setRoomCodeInLocation,
} from "./online-room.js";

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CAFÃ‰ CHAOS v4 â€” Difficulty + Sound + Movement Overhaul
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const COLS = 18, ROWS = 8;
const DIRS = { up:[-1,0], down:[1,0], left:[0,-1], right:[0,1] };

const DIFF = {
  chill:  { label:"CHILL",  time:240, patMul:2.2, spawnBase:16, spawnMin:9,  tierDelay:[60,150], desc:"Relaxed pace, patient customers", clr:"#8fce7e" },
  normal: { label:"NORMAL", time:180, patMul:1.0, spawnBase:12, spawnMin:5,  tierDelay:[30,90],  desc:"The real cafe experience",       clr:"#ff9800" },
  hectic: { label:"HECTIC", time:150, patMul:0.7, spawnBase:8,  spawnMin:3,  tierDelay:[15,45],  desc:"Pure chaos. Good luck.",          clr:"#ff4444" },
};

const POWER_RULES = {
  maxFlow:100,
  serveGain:24,
  comboBonus:7,
  missPenalty:22,
  failPenalty:12,
  rushCost:45,
  freezeCost:90,
  rushMs:10000,
  freezeMs:8000,
  rushMoveDelay:80,
};

const TIMER_RULES = {
  serveBase:{chill:5,normal:6,hectic:7},
  quickBonusMax:2,
  comboBonus:{3:1,5:2},
  missPenalty:{chill:7,normal:9,hectic:11},
  failPenalty:3,
};

const P = {
  bg:"#1a0f08", floor1:"#6b4226", floor2:"#5c3a22", floor3:"#7a4e30",
  wall:"#2d1b0e", wallHi:"#3a2215", wallLine:"#4a2c1a",
  counter:"#8B6914", counterTop:"#A07828", counterEdge:"#6B5010",
  p1:"#4fc3f7", p1d:"#2196f3", p2:"#f48fb1", p2d:"#e91e63",
  skin:"#ffcc99", white:"#fff", black:"#000",
  cupW:"#f5f5f5", cupR:"#ddd",
  esp:"#3e1c0a", milk:"#f0ead6", foam:"#fffef5",
  mat:"#5ea44c", matL:"#8fce7e", car:"#c8820a", str:"#e84060",
  tea:"#b87333", wat:"#5bc0de", hot:"#ff7043",
  ice:"#c8e6ff", iceS:"#e8f4ff",
  gold:"#ffd700", red:"#ff4444", green:"#4caf50", orange:"#ff9800",
};

const RECIPES = {
  "Espresso":           {ing:["espresso"],                           pts:10,tier:1,clr:P.esp},
  "Cafe Latte":         {ing:["espresso","steamed_milk"],            pts:20,tier:1,clr:"#c4a882"},
  "Macchiato":          {ing:["espresso","foam"],                    pts:20,tier:1,clr:"#8b6914"},
  "Iced Latte":         {ing:["espresso","milk","ice"],              pts:25,tier:2,clr:"#d4c5a9"},
  "Iced Caramel Latte": {ing:["espresso","milk","ice","caramel"],    pts:35,tier:2,clr:P.car},
  "Matcha Latte":       {ing:["matcha","steamed_milk"],              pts:25,tier:2,clr:P.mat},
  "Iced Matcha":        {ing:["matcha","milk","ice"],                pts:30,tier:2,clr:P.matL},
  "Strawberry Matcha":  {ing:["matcha","strawberry","milk","ice"],   pts:40,tier:3,clr:P.str},
  "Hot Tea":            {ing:["tea","hot_water"],                    pts:15,tier:1,clr:P.tea},
  "Iced Tea":           {ing:["tea","water","ice"],                  pts:20,tier:2,clr:"#b8860b"},
  "Caramel Macchiato":  {ing:["espresso","foam","caramel"],          pts:30,tier:2,clr:"#d4a030"},
  "Double Espresso":    {ing:["espresso","espresso2"],               pts:18,tier:1,clr:"#2a1008"},
};

const ING_C = {
  espresso:P.esp, espresso2:"#2a1008", steamed_milk:P.milk, milk:P.milk,
  foam:P.foam, ice:P.ice, caramel:P.car, matcha:P.mat,
  strawberry:P.str, tea:P.tea, hot_water:P.hot, water:P.wat,
};

const ING_TO_STATION={
  espresso:"E",espresso2:"e",steamed_milk:"M",milk:"m",
  foam:"F",ice:"I",caramel:"R",matcha:"A",
  strawberry:"B",tea:"T",hot_water:"H",water:"Q",
};

const STATIONS = {
  E:{id:"espresso",  label:"Espresso",adds:"espresso",    time:1800,clr:P.esp,short:"ESP"},
  e:{id:"espresso2", label:"2x Esp",  adds:"espresso2",   time:1800,clr:"#2a1008",short:"2X"},
  M:{id:"steamer",   label:"Steam",   adds:"steamed_milk",time:1400,clr:P.milk,short:"STM"},
  m:{id:"milk",      label:"Milk",    adds:"milk",        clr:P.milk,short:"MLK"},
  F:{id:"foam",      label:"Foam",    adds:"foam",        clr:P.foam,short:"FOAM"},
  I:{id:"ice",       label:"Ice",     adds:"ice",         clr:P.ice,short:"ICE"},
  R:{id:"caramel",   label:"Caramel", adds:"caramel",     clr:P.car,short:"CARM"},
  A:{id:"matcha",    label:"Matcha",  adds:"matcha",      clr:P.mat,short:"MCHA"},
  B:{id:"strawberry",label:"Berry",   adds:"strawberry",  clr:P.str,short:"BERR"},
  T:{id:"tea",       label:"Tea",     adds:"tea",         time:1600,clr:P.tea,short:"TEA"},
  H:{id:"hot_water", label:"Hot Wtr", adds:"hot_water",   clr:P.hot,short:"HOT"},
  Q:{id:"water",     label:"Water",   adds:"water",       clr:P.wat,short:"WATR"},
  U:{id:"cups",      label:"Cups",    action:"give_cup",short:"CUPS"},
  X:{id:"trash",     label:"Trash",   action:"trash",short:"BIN"},
};

const MAPS = {
  classic:{
    id:"classic",
    name:"SunBooks",
    desc:"Green-logo bookstore cafe with warm shelves and window bar seating.",
    raw:[
      "WSSSSSSSSSSSSSSSSW",
      "W................W",
      "WE..CC....CC..A..W",
      "We............B..W",
      "WM..CC....CC..T..W",
      "Wm........H.Q....W",
      "WF.U.I..R..X...C.W",
      "WWWWWWWWWWWWWWWWWW",
    ],
    theme:{
      deco:"sunbooks",
      top:"#18392d",
      panel:"#21473a",
      trim:"#92d0a5",
      text:"#ecf7ef",
      accent:"#5ab97f",
      wood:"#6e4b2d",
      shelf:"#7b5a36",
      lamp:"#f4c66b",
      logo:"SUNBOOKS",
      subtitle:"COFFEE + STORIES",
      glow:"90,185,127",
    },
    spawns:[[4,6],[4,11]],
  },
  speedway:{
    id:"speedway",
    name:"Catpuccino",
    desc:"Cozy cat cafe with window perches, chalkboard menus, and sleepy regulars.",
    raw:[
      "WSSSSSSSSSSSSSSSSW",
      "W................W",
      "WEA.CC....CC..T..W",
      "We............B..W",
      "WM..CC....CC..H..W",
      "Wm...........Q...W",
      "WF.U.I..R..X.....W",
      "WWWWWWWWWWWWWWWWWW",
    ],
    theme:{
      deco:"catcafe",
      top:"#5a3a34",
      panel:"#48633f",
      trim:"#f4d39c",
      text:"#fff1dd",
      accent:"#f2b36f",
      wood:"#8a5d45",
      shelf:"#6d4b3d",
      lamp:"#f6d8aa",
      logo:"CATPUCCINO",
      subtitle:"LATTES + LAP CATS",
      glow:"246,214,159",
    },
    spawns:[[4,6],[4,11]],
  },
  crossroads:{
    id:"crossroads",
    name:"Central Perks",
    desc:"Sky-high couch cafe with city windows up top and the order line at the bottom.",
    raw:[
      "WWWWWWWWWWWWWWWWWW",
      "WE..CC....CC..A..W",
      "We............B..W",
      "WM..CC....CC..T..W",
      "Wm........H.Q....W",
      "WF.U.I..R..X.....W",
      "W................W",
      "WSSSSSSSSSSSSSSSSW",
    ],
    theme:{
      deco:"centralperks",
      top:"#9fc9ec",
      panel:"#2c685f",
      trim:"#f0c989",
      text:"#fff5e5",
      accent:"#d9784f",
      wood:"#8d5d45",
      shelf:"#c6b18e",
      lamp:"#f6d4a0",
      logo:"CENTRAL PERKS",
      subtitle:"SKYLINE BREWS + COUCH TALK",
      glow:"212,231,255",
      customerSide:"bottom",
    },
    spawns:[[4,6],[4,11]],
  },
  halloween:{
    id:"halloween",
    name:"Spooky Brews",
    desc:"A haunted cafe under a full moon with cobwebs, bats, and jack-o-lanterns glowing.",
    raw:[
      "WSSSSSSSSSSSSSSSSW",
      "W................W",
      "WE..CC....CC..A..W",
      "We............B..W",
      "WM..CC....CC..T..W",
      "Wm........H.Q....W",
      "WF.U.I..R..X...C.W",
      "WWWWWWWWWWWWWWWWWW",
    ],
    theme:{
      deco:"halloween",
      top:"#1a0a20",
      panel:"#2a1030",
      trim:"#ff8c00",
      text:"#ffe0b0",
      accent:"#9b30ff",
      wood:"#3a2018",
      shelf:"#4a2828",
      lamp:"#ff6600",
      logo:"SPOOKY BREWS",
      subtitle:"TRICKS + TREATS",
      glow:"255,120,40",
    },
    spawns:[[4,6],[4,11]],
  },
  winter:{
    id:"winter",
    name:"Frost & Joy",
    desc:"A cozy winter lodge cafe with snow outside, string lights, and a warm fireplace glow.",
    raw:[
      "WSSSSSSSSSSSSSSSSW",
      "W................W",
      "WEA.CC....CC..T..W",
      "We............B..W",
      "WM..CC....CC..H..W",
      "Wm...........Q...W",
      "WF.U.I..R..X.....W",
      "WWWWWWWWWWWWWWWWWW",
    ],
    theme:{
      deco:"winter",
      top:"#1a2a40",
      panel:"#1e3050",
      trim:"#cc2222",
      text:"#f0f4ff",
      accent:"#4fc3f7",
      wood:"#5a4030",
      shelf:"#6a5040",
      lamp:"#ffe4b0",
      logo:"FROST & JOY",
      subtitle:"WARM CUPS + COZY NIGHTS",
      glow:"255,230,180",
    },
    spawns:[[4,6],[4,11]],
  },
  eid:{
    id:"eid",
    name:"Eid Cafe",
    desc:"A beautifully decorated cafe celebrating Eid with lanterns, geometric patterns, and golden arches.",
    raw:[
      "WWWWWWWWWWWWWWWWWW",
      "WE..CC....CC..A..W",
      "We............B..W",
      "WM..CC....CC..T..W",
      "Wm........H.Q....W",
      "WF.U.I..R..X.....W",
      "W................W",
      "WSSSSSSSSSSSSSSSSW",
    ],
    theme:{
      deco:"eid",
      top:"#0a1830",
      panel:"#1a3050",
      trim:"#d4af37",
      text:"#fff8e0",
      accent:"#40bfa0",
      wood:"#5a3828",
      shelf:"#6a4838",
      lamp:"#f0c860",
      logo:"EID CAFE",
      subtitle:"EID MUBARAK",
      glow:"212,175,55",
      customerSide:"bottom",
    },
    spawns:[[4,6],[4,11]],
  },
};

const CAT_COACH={
  name:"Beans",
  role:"Barista Cat",
  fur:"#f0c070",
  earInner:"#f0a0a0",
  nose:"#e08888",
  skin:"#f0c070",
  hair:"#f0c070",
  shirt:"#5ab97f",
  accent:"#dff3e4",
};
const CAT_CONGRATS=["Purrfect!","Meow-velous!","That's the way!","Nailed it, nya~!","You're a natural!","Fur-tastic work!","Purr-ecisely right!","Great job, meow!"];

const TRAINING_TRACKS={
  coffee_basics:{
    id:"coffee_basics",
    title:"Coffee Basics",
    subtitle:"Pull espresso, steam milk, and learn what makes a macchiato distinct.",
    mapKey:"classic",
    color:"#8fce7e",
    drinks:["Espresso","Cafe Latte","Macchiato","Double Espresso"],
    steps:[
      {
        drink:"Espresso",
        headline:"Start with the base shot",
        mentor:"Every coffee lesson starts with espresso. Pull it into an empty cup from the ESP machine.",
        why:"Espresso is the concentrated coffee base. Everything in this lesson builds on that shot.",
        tip:"Timed stations like ESP need a moment to finish brewing before the ingredient drops into your cup.",
      },
      {
        drink:"Cafe Latte",
        headline:"Milk changes the body",
        mentor:"Now turn that shot into a latte with steamed milk.",
        why:"Steamed milk makes a latte silky and mellow. Plain milk stays cold and won't count as a proper cafe latte here.",
        tip:"Use the steam wand station, not the plain milk station.",
      },
      {
        drink:"Macchiato",
        headline:"Foam, not milk",
        mentor:"A macchiato is espresso marked with foam, not filled with milk.",
        why:"Foam keeps the drink sharp and airy. If you use regular milk, you soften the espresso and drift toward latte territory instead.",
        tip:"Build it as espresso plus foam, then serve it at the bell.",
      },
      {
        drink:"Double Espresso",
        headline:"Same machine, twice",
        mentor:"For a double espresso, pull two shots into the same cup.",
        why:"You're stacking intensity, not changing texture. That is why this recipe is just espresso plus espresso again.",
        tip:"Use ESP and then 2X ESP, or pull two espresso shots if the map offers both lanes.",
      },
    ],
  },
  iced_lab:{
    id:"iced_lab",
    title:"Iced Lab",
    subtitle:"Practice cold drinks, caramel builds, and the difference between milk and foam.",
    mapKey:"classic",
    color:"#f0c989",
    drinks:["Iced Latte","Iced Caramel Latte","Caramel Macchiato"],
    steps:[
      {
        drink:"Iced Latte",
        headline:"Cool the latte down",
        mentor:"Build an iced latte with espresso, milk, and ice.",
        why:"Milk keeps the drink creamy even when chilled. Ice changes temperature and texture, but it does not replace the milk itself.",
        tip:"The easiest order is usually espresso first, then milk, then ice.",
      },
      {
        drink:"Iced Caramel Latte",
        headline:"Add sweetness last",
        mentor:"Now add caramel to that iced latte formula.",
        why:"Caramel is a flavor layer. It doesn't replace the espresso, milk, or ice; it sits on top of that base and sweetens it.",
        tip:"Think of this one as iced latte plus caramel.",
      },
      {
        drink:"Caramel Macchiato",
        headline:"Macchiato logic still matters",
        mentor:"This one keeps the macchiato structure: espresso, foam, and caramel.",
        why:"The caramel adds sweetness, but foam still matters because the drink should stay brighter and more layered than a latte.",
        tip:"If you use milk instead of foam, the recipe won't match.",
      },
    ],
  },
  matcha_lab:{
    id:"matcha_lab",
    title:"Matcha Lab",
    subtitle:"Learn how matcha pairs differently with steamed milk, cold milk, and berry syrup.",
    mapKey:"speedway",
    color:"#8fce7e",
    drinks:["Matcha Latte","Iced Matcha","Strawberry Matcha"],
    steps:[
      {
        drink:"Matcha Latte",
        headline:"Warm and smooth",
        mentor:"Start with a matcha latte: matcha plus steamed milk.",
        why:"Steamed milk rounds out the grassy matcha flavor and makes the drink feel soft instead of sharp.",
        tip:"Use the steam wand, not plain milk, for this one.",
      },
      {
        drink:"Iced Matcha",
        headline:"Cold version, different texture",
        mentor:"Now make the iced version with matcha, milk, and ice.",
        why:"Cold milk keeps the drink clean and refreshing. Steam would turn it into the hot latte profile instead.",
        tip:"No espresso belongs in any of the matcha tutorials.",
      },
      {
        drink:"Strawberry Matcha",
        headline:"Fruit on top of the matcha base",
        mentor:"Finish with strawberry matcha by adding berry syrup to the iced matcha formula.",
        why:"Berry brightens the earthy matcha and pushes the drink toward dessert without changing its chilled base.",
        tip:"Build the iced matcha first, then add berry.",
      },
    ],
  },
  tea_house:{
    id:"tea_house",
    title:"Tea House",
    subtitle:"Understand when tea wants hot water and when it wants a chilled finish instead.",
    mapKey:"crossroads",
    color:"#d9784f",
    drinks:["Hot Tea","Iced Tea"],
    steps:[
      {
        drink:"Hot Tea",
        headline:"Steep with heat",
        mentor:"Hot tea is simply tea plus hot water.",
        why:"Hot water is what actually steeps the tea and opens the flavor. Plain cold water would leave the drink unfinished.",
        tip:"Tea is a timed station, so wait for it to finish before adding the hot water.",
      },
      {
        drink:"Iced Tea",
        headline:"Chill it properly",
        mentor:"For iced tea, use tea, water, and ice.",
        why:"Once the tea is brewed, regular water and ice cool it down cleanly. Hot water would keep the drink in the hot-tea lane instead.",
        tip:"This is tea plus water plus ice, not tea plus hot water plus ice.",
      },
    ],
  },
};

function CatCoachAvatar({size=36,talking=false,blink=false}){
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" style={{flexShrink:0,display:"block"}}>
      <polygon points="4,14 9,2 15,13" fill="#f0c070"/>
      <polygon points="21,13 27,2 32,14" fill="#f0c070"/>
      <polygon points="7,13 10,5 13,12" fill="#f0a0a0"/>
      <polygon points="23,12 26,5 29,13" fill="#f0a0a0"/>
      <ellipse cx="18" cy="22" rx="14" ry="13" fill="#f0c070"/>
      {blink
        ?<><rect x="9" y="20" width="6" height="1.5" rx="0.75" fill="#332014"/><rect x="21" y="20" width="6" height="1.5" rx="0.75" fill="#332014"/></>
        :<><ellipse cx="12" cy="20" rx="2.5" ry="3" fill="#332014"/><ellipse cx="24" cy="20" rx="2.5" ry="3" fill="#332014"/>
          <circle cx="13.2" cy="18.8" r="1.2" fill="#fff"/><circle cx="25.2" cy="18.8" r="1.2" fill="#fff"/></>}
      <ellipse cx="18" cy="25" rx="2" ry="1.5" fill="#e08888"/>
      {talking
        ?<ellipse cx="18" cy="28.5" rx="3.5" ry="2.5" fill="#c04040"/>
        :<><line x1="14.5" y1="27.5" x2="18" y2="29" stroke="#a06040" strokeWidth="1.2" strokeLinecap="round"/><line x1="21.5" y1="27.5" x2="18" y2="29" stroke="#a06040" strokeWidth="1.2" strokeLinecap="round"/></>}
      <line x1="0" y1="23" x2="9" y2="24.5" stroke="#c4956a" strokeWidth="0.8" opacity="0.5"/>
      <line x1="0" y1="26" x2="9" y2="25.5" stroke="#c4956a" strokeWidth="0.8" opacity="0.5"/>
      <line x1="36" y1="23" x2="27" y2="24.5" stroke="#c4956a" strokeWidth="0.8" opacity="0.5"/>
      <line x1="36" y1="26" x2="27" y2="25.5" stroke="#c4956a" strokeWidth="0.8" opacity="0.5"/>
    </svg>
  );
}

function CatCoachBubble({text,type="step",tip,ingredients=[],stepLabel="",trackColor="#8fce7e",isMobile,onClose,onReset,onExit}){
  const[talking,setTalking]=useState(false);
  const[blinking,setBlinking]=useState(false);
  const talkRef=useRef(null);
  const autoRef=useRef(null);
  const blinkRef=useRef(null);

  useEffect(()=>{
    clearInterval(talkRef.current);clearTimeout(autoRef.current);
    if(!text){setTalking(false);return;}
    let mouth=true;setTalking(true);
    talkRef.current=setInterval(()=>{mouth=!mouth;setTalking(mouth);},180);
    const dur=Math.min(3500,Math.max(1200,text.length*40));
    const stopTalk=setTimeout(()=>{clearInterval(talkRef.current);setTalking(false);},dur);
    autoRef.current=setTimeout(()=>onClose?.(),type==="congrats"?3500:12000);
    return ()=>{clearInterval(talkRef.current);clearTimeout(autoRef.current);clearTimeout(stopTalk);};
  },[text,type]);

  useEffect(()=>{
    blinkRef.current=setInterval(()=>{setBlinking(true);setTimeout(()=>setBlinking(false),150);},3000+Math.random()*2000);
    return ()=>clearInterval(blinkRef.current);
  },[]);

  if(!text)return null;

  return (
    <div style={{
      display:"flex",alignItems:"flex-start",gap:isMobile?6:10,
      background:"linear-gradient(180deg,#21120cd9 0%,#120904c7 100%)",
      border:`1px solid ${trackColor}66`,borderRadius:isMobile?14:18,
      padding:isMobile?"7px 10px 6px":"10px 14px 8px",
      boxShadow:"0 12px 28px #0000002e",
      backdropFilter:"blur(16px) saturate(1.12)",
      maxWidth:isMobile?380:420,width:isMobile?"min(92vw,380px)":undefined,
      pointerEvents:"auto",animation:"catBubbleIn .22s ease-out",
      cursor:type==="step"?"pointer":"default",
    }} onClick={type==="step"?onClose:undefined}>
      <div style={{position:"relative",flexShrink:0}}>
        <CatCoachAvatar size={isMobile?30:38} talking={talking} blink={blinking}/>
      </div>
      <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:isMobile?3:5}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:6}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:isMobile?8:9,color:trackColor,fontFamily:"'Silkscreen',monospace"}}>{CAT_COACH.name}</span>
            {stepLabel&&<span style={{fontSize:7,color:"#8a6a4a",fontFamily:"'Silkscreen',monospace"}}>{stepLabel}</span>}
          </div>
          {type==="step"&&<span style={{fontSize:6,color:"#4a2a1899",fontFamily:"'Silkscreen',monospace"}}>TAP TO CLOSE</span>}
        </div>
        <div style={{
          fontSize:isMobile?(type==="congrats"?13:10):(type==="congrats"?15:11),
          color:type==="congrats"?P.gold:"#f3e2cb",
          lineHeight:1.7,fontFamily:"'Outfit','Silkscreen',sans-serif",fontWeight:type==="congrats"?700:400,
          ...(type==="congrats"?{textShadow:`0 0 10px ${P.gold}44`}:{}),
        }}>{text}</div>
        {type==="step"&&tip&&<div style={{fontSize:isMobile?8:9,color:"#9de7ff",lineHeight:1.55,fontFamily:"'Outfit','Silkscreen',sans-serif"}}>{tip}</div>}
        {type==="step"&&ingredients.length>0&&(
          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
            {ingredients.map((ing,idx)=>(
              <div key={idx} style={{display:"flex",alignItems:"center",gap:3,background:"#2d1b0e",border:"1px solid #4a2a18",borderRadius:999,padding:"2px 6px",fontSize:isMobile?7:7,color:"#f5e6d3"}}>
                <div style={{width:8,height:8,borderRadius:2,background:ING_C[ing],border:"1px solid #fff2"}}/>
                <span>{ing.replaceAll("_"," ")}</span>
              </div>
            ))}
          </div>
        )}
        {type==="step"&&(
          <div style={{display:"flex",gap:6,marginTop:1}} onClick={e=>e.stopPropagation()}>
            <button onClick={onReset} style={{fontFamily:"'Silkscreen',monospace",fontSize:isMobile?7:8,padding:"4px 8px",borderRadius:8,border:"1px solid #6b3a1f88",background:"#2d1b0e",color:"#f5e6d3",cursor:"pointer"}}>RESET</button>
            <button onClick={onExit} style={{fontFamily:"'Silkscreen',monospace",fontSize:isMobile?7:8,padding:"4px 8px",borderRadius:8,border:"1px solid #3a2215",background:"transparent",color:"#8a6a4a",cursor:"pointer"}}>EXIT</button>
          </div>
        )}
      </div>
    </div>
  );
}

function buildMapGrid(raw){
  const grid=[];
  for(let r=0;r<ROWS;r++){
    grid[r]=[];
    for(let c=0;c<COLS;c++){
      const ch=(raw[r]||"")[c]||"W";
      if(ch===".")grid[r][c]={type:"floor"};
      else if(ch==="W")grid[r][c]={type:"wall"};
      else if(ch==="S")grid[r][c]={type:"station",station:"serve"};
      else if(ch==="C")grid[r][c]={type:"counter"};
      else if(STATIONS[ch])grid[r][c]={type:"station",station:ch};
      else grid[r][c]={type:"floor"};
    }
  }
  return grid;
}

let ACTIVE_MAP_KEY="classic";
let MAP=buildMapGrid(MAPS[ACTIVE_MAP_KEY].raw);

function setActiveMap(key="classic"){
  ACTIVE_MAP_KEY=MAPS[key]?key:"classic";
  MAP=buildMapGrid(MAPS[ACTIVE_MAP_KEY].raw);
  return MAPS[ACTIVE_MAP_KEY];
}

function getActiveMapDef(){
  return MAPS[ACTIVE_MAP_KEY]||MAPS.classic;
}

const isFloor=(r,c)=>r>=0&&r<ROWS&&c>=0&&c<COLS&&(MAP[r][c].type==="floor"||MAP[r][c].type==="counter");
const CUST=["Alex","Sam","Jo","Max","Lee","Sky","Ash","Bay","Kit","Ren","Kai","Pip","Zoe","Cam"];
const PLAYER_STYLES = [
  { main:P.p1, dark:P.p1d, apron:"#2196f3", pants:"#1565c0", shoes:"#0d47a1" },
  { main:P.p2, dark:P.p2d, apron:"#e91e63", pants:"#ad1457", shoes:"#880e4f" },
];
const CHARACTERS=[
  {id:"bean",name:"Bean",type:"human",skin:"#ffcc99",hair:"#5a3018",hat:"#ffffff",apron:"#2196f3",pants:"#1565c0",shoes:"#0d47a1",accent:"#64b5f6"},
  {id:"mocha",name:"Mocha",type:"human",skin:"#c08050",hair:"#1a0a06",hat:"#fff8e0",apron:"#e91e63",pants:"#ad1457",shoes:"#880e4f",accent:"#f06292"},
  {id:"matcha",name:"Matcha",type:"human",skin:"#f0c080",hair:"#2d1b10",hat:"#e8f5e9",apron:"#4caf50",pants:"#2e7d32",shoes:"#1b5e20",accent:"#81c784"},
  {id:"beans",name:"Beans",type:"cat",fur:"#f0c070",earInner:"#f0a0a0",nose:"#e08888",apron:"#5ab97f",pants:"#3d8b5e",shoes:"#2e6b48",accent:"#a5d6a7"},
  {id:"whiskers",name:"Whiskers",type:"cat",fur:"#d0d0d0",earInner:"#f0b0b0",nose:"#e8a0a0",apron:"#ff9800",pants:"#e65100",shoes:"#bf360c",accent:"#ffb74d"},
  {id:"caramel",name:"Caramel",type:"human",skin:"#d4a06a",hair:"#8d5524",hat:"#fff3e0",apron:"#ff9800",pants:"#e65100",shoes:"#bf360c",accent:"#ffb74d"},
  {id:"latte",name:"Latte",type:"girl",skin:"#ffcc99",hair:"#5a2810",bow:"#e91e63",apron:"#e91e63",pants:"#ad1457",shoes:"#880e4f",accent:"#f48fb1"},
  {id:"frost",name:"Frost",type:"human",skin:"#fce4ec",hair:"#90caf9",hat:"#e3f2fd",apron:"#42a5f5",pants:"#1976d2",shoes:"#0d47a1",accent:"#90caf9"},
  {id:"shadow",name:"Shadow",type:"cat",fur:"#2a2228",earInner:"#6a4060",nose:"#8a6080",apron:"#7b1fa2",pants:"#4a148c",shoes:"#311b92",accent:"#ce93d8"},
  {id:"gordo",name:"Gordo Ramsbean",type:"chef",skin:"#f5d0b0",hair:"#e0d4c0",apron:"#ffffff",pants:"#2a2a2a",shoes:"#1a1a1a",accent:"#ff5252",wrinkles:true},
  {id:"brewbot",name:"Brew-Bot",type:"robot",body:"#b0b8c0",eye:"#4fc3f7",chest:"#78909c",apron:"#ffcc02",pants:"#607d8b",shoes:"#455a64",accent:"#4fc3f7"},
];
function charToClr(charDef,pid){
  const pstyle=PLAYER_STYLES[pid]||PLAYER_STYLES[0];
  return {
    main:pstyle.main,dark:pstyle.dark,
    apron:charDef.apron,pants:charDef.pants,shoes:charDef.shoes,
    type:charDef.type,skin:charDef.skin,hair:charDef.hair,hat:charDef.hat,
    fur:charDef.fur,earInner:charDef.earInner,nose:charDef.nose,
    bow:charDef.bow,wrinkles:charDef.wrinkles,
    body:charDef.body,eye:charDef.eye,chest:charDef.chest,
  };
}
const CUSTOMER_SKINS=["#ffcc99","#f0c080","#d4a06a","#c08050","#8d5524"];
const CUSTOMER_STYLES=[
  { shirt:"#7e57c2", accent:"#b39ddb", hair:"#2f1b12" },
  { shirt:"#42a5f5", accent:"#90caf9", hair:"#3b2618" },
  { shirt:"#ef5350", accent:"#ff8a80", hair:"#24150d" },
  { shirt:"#66bb6a", accent:"#a5d6a7", hair:"#51311f" },
  { shirt:"#ffa726", accent:"#ffcc80", hair:"#1f1209" },
  { shirt:"#26a69a", accent:"#80cbc4", hair:"#342116" },
];
const MAX_QUEUE_SLOTS=6;
const QUEUE_COLS=Array.from({length:MAX_QUEUE_SLOTS},(_,idx)=>1.9+idx*((COLS-3.8)/Math.max(1,MAX_QUEUE_SLOTS-1)));
const PENDANT_COLS=Array.from({length:8},(_,idx)=>1.6+idx*((COLS-3.2)/7));
const AMBIENT_CUSTOMERS=[
  { name:"Nia", skin:CUSTOMER_SKINS[1], shirt:"#5c6bc0", accent:"#9fa8da", hair:"#312014", mood:"laptop", side:"left", scale:.8 },
  { name:"Owen", skin:CUSTOMER_SKINS[3], shirt:"#8d6e63", accent:"#bcaaa4", hair:"#21140b", mood:"drink", side:"right", scale:.86 },
  { name:"Ivy", skin:CUSTOMER_SKINS[0], shirt:"#ec407a", accent:"#f48fb1", hair:"#463122", mood:"phone", side:"right", scale:.74 },
];

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const flowGainForCombo=(combo)=>clamp(POWER_RULES.serveGain+Math.max(0,combo-1)*POWER_RULES.comboBonus,POWER_RULES.serveGain,42);
const timeGainForServe=(order,combo,diff)=>{
  const patiencePct=clamp(1-order.elapsed/order.patience,0,1);
  const base=TIMER_RULES.serveBase[diff]??6;
  const quickBonus=Math.min(TIMER_RULES.quickBonusMax,Math.floor(patiencePct*(TIMER_RULES.quickBonusMax+1)));
  const comboBonus=combo>=5?TIMER_RULES.comboBonus[5]:combo>=3?TIMER_RULES.comboBonus[3]:0;
  return base+quickBonus+comboBonus;
};

function useIsMobile(){const[m,s]=useState(false);useEffect(()=>{const c=()=>s(window.innerWidth<768||"ontouchstart"in window);c();window.addEventListener("resize",c);return ()=>window.removeEventListener("resize",c);},[]);return m;}
function readViewport(){const vv=window.visualViewport;return{w:Math.round(vv?.width||window.innerWidth),h:Math.round(vv?.height||window.innerHeight)};}
function useScreen(){const[s,set]=useState(()=>readViewport());useEffect(()=>{const r=()=>set(readViewport());const vv=window.visualViewport;r();window.addEventListener("resize",r);window.addEventListener("orientationchange",r);vv?.addEventListener("resize",r);vv?.addEventListener("scroll",r);return ()=>{window.removeEventListener("resize",r);window.removeEventListener("orientationchange",r);vv?.removeEventListener("resize",r);vv?.removeEventListener("scroll",r);};},[]);return s;}

const haptic=(t="light")=>{try{navigator?.vibrate?.({light:10,medium:25,heavy:50}[t]||10);}catch(e){}};
const IOS_RE=/iPad|iPhone|iPod/i;

function isStandaloneDisplay(){
  return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator?.standalone === true;
}

function useShellActions(){
  const deferredInstall=useRef(null);
  const[installHelpOpen,setInstallHelpOpen]=useState(false);
  const[state,setState]=useState({isIos:false,isStandalone:false,isFullscreen:false,canFullscreen:false,hasInstallPrompt:false});

  const refresh=useCallback(()=>{
    setState({
      isIos:IOS_RE.test(window.navigator.userAgent||""),
      isStandalone:isStandaloneDisplay(),
      isFullscreen:!!document.fullscreenElement,
      canFullscreen:!!document.documentElement?.requestFullscreen && !!document.fullscreenEnabled,
      hasInstallPrompt:!!deferredInstall.current,
    });
  },[]);

  useEffect(()=>{
    refresh();
    const media=window.matchMedia?.("(display-mode: standalone)");
    const onMedia=()=>refresh();
    const onBeforeInstallPrompt=(event)=>{
      event.preventDefault();
      deferredInstall.current=event;
      refresh();
    };
    const onInstalled=()=>{
      deferredInstall.current=null;
      setInstallHelpOpen(false);
      refresh();
    };

    window.addEventListener("beforeinstallprompt",onBeforeInstallPrompt);
    window.addEventListener("appinstalled",onInstalled);
    document.addEventListener("fullscreenchange",refresh);
    window.addEventListener("orientationchange",refresh);
    media?.addEventListener?.("change",onMedia);
    media?.addListener?.(onMedia);

    return ()=>{
      window.removeEventListener("beforeinstallprompt",onBeforeInstallPrompt);
      window.removeEventListener("appinstalled",onInstalled);
      document.removeEventListener("fullscreenchange",refresh);
      window.removeEventListener("orientationchange",refresh);
      media?.removeEventListener?.("change",onMedia);
      media?.removeListener?.(onMedia);
    };
  },[refresh]);

  const promptInstall=useCallback(async()=>{
    if(deferredInstall.current){
      const prompt=deferredInstall.current;
      try{
        await prompt.prompt();
        await prompt.userChoice;
      }catch(e){}
      deferredInstall.current=null;
      refresh();
      return;
    }
    if(IOS_RE.test(window.navigator.userAgent||"")&&!isStandaloneDisplay()){
      setInstallHelpOpen(true);
    }
  },[refresh]);

  const toggleFullscreen=useCallback(async()=>{
    try{
      if(document.fullscreenElement){await document.exitFullscreen?.();}
      else{await document.documentElement?.requestFullscreen?.({navigationUI:"hide"});}
      refresh();
    }catch(e){}
  },[refresh]);

  return {
    ...state,
    installHelpOpen,
    showInstallAction:state.hasInstallPrompt||(state.isIos&&!state.isStandalone),
    showFullscreenAction:state.canFullscreen&&!state.isStandalone,
    promptInstall,
    toggleFullscreen,
    openInstallHelp:()=>setInstallHelpOpen(true),
    closeInstallHelp:()=>setInstallHelpOpen(false),
  };
}

const AUDIO_PREFS_KEY="cafe-chaos-audio-prefs";
const DEFAULT_AUDIO_PREFS={music:true,sfx:true};
const MUSIC_MODULES=import.meta.glob("./assets/audio/music/*.{mp3,ogg,wav,m4a}",{eager:true,import:"default"});
const SFX_MODULES=import.meta.glob("./assets/audio/sfx/*.{mp3,ogg,wav,m4a}",{eager:true,import:"default"});

function audioStem(path){
  return path.split("/").pop()?.replace(/\.(mp3|ogg|wav|m4a)$/i,"")||"";
}

function trackLabel(stem){
  return stem.replace(/[-_]+/g," ").replace(/\b\w/g,(m)=>m.toUpperCase());
}

function normalizeAudioStem(stem){
  return (stem||"").toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
}

function isMenuMusicStem(stem){
  const normalized=normalizeAudioStem(stem);
  return normalized==="main_theme" || normalized.includes("menu_theme") || normalized.includes("title_theme") || normalized.startsWith("menu_") || normalized.startsWith("title_");
}

const MUSIC_TRACKS=Object.entries(MUSIC_MODULES)
  .sort(([a],[b])=>a.localeCompare(b))
  .map(([path,url],idx)=>({id:idx,stem:audioStem(path),name:trackLabel(audioStem(path)),url}));
const MENU_MUSIC_TRACKS=MUSIC_TRACKS.filter((track)=>isMenuMusicStem(track.stem));
const GAMEPLAY_MUSIC_TRACKS=MUSIC_TRACKS.filter((track)=>!isMenuMusicStem(track.stem));
const SFX_FILE_URLS=Object.fromEntries(
  Object.entries(SFX_MODULES).map(([path,url])=>[audioStem(path),url])
);

function loadAudioPrefs(){
  try{
    const stored=window.localStorage.getItem(AUDIO_PREFS_KEY);
    if(!stored)return DEFAULT_AUDIO_PREFS;
    const parsed=JSON.parse(stored);
    return {
      music:parsed?.music!==false,
      sfx:parsed?.sfx!==false,
    };
  }catch(e){
    return DEFAULT_AUDIO_PREFS;
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// AUDIO ENGINE â€” Musical & Fun
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
class SFX {
  constructor(){
    this.ctx=null;
    this.vol=null;
    this.compressor=null;
    this.sfxEnabled=true;
    this.musicEnabled=true;
    this.musicVolume=.32;
    this.sfxVolume=.72;
    this.menuMusicTracks=MENU_MUSIC_TRACKS.length?MENU_MUSIC_TRACKS:(MUSIC_TRACKS[0]?[MUSIC_TRACKS[0]]:[]);
    this.gameplayMusicTracks=GAMEPLAY_MUSIC_TRACKS.length?GAMEPLAY_MUSIC_TRACKS:MUSIC_TRACKS;
    this.musicMode="gameplay";
    this.musicTracks=this.gameplayMusicTracks;
    this.musicIndex=0;
    this.musicEl=null;
    this.musicRate=1;
    this.filePool={};
  }
  init(){
    if(!this.ctx){
      try{
        this.ctx=new(window.AudioContext||window.webkitAudioContext)();
        this.compressor=this.ctx.createDynamicsCompressor();
        this.compressor.threshold.value=-24;this.compressor.knee.value=30;
        this.compressor.ratio.value=12;this.compressor.attack.value=.003;this.compressor.release.value=.25;
        this.vol=this.ctx.createGain();this.vol.gain.value=.35;
        this.vol.connect(this.compressor);this.compressor.connect(this.ctx.destination);
      }catch(e){}
    }
    this.ctx?.resume?.().catch(()=>{});
    this.startMusic();
  }
  setPrefs(prefs={}){
    this.musicEnabled=prefs.music!==false;
    this.sfxEnabled=prefs.sfx!==false;
    if(this.musicEl)this.musicEl.volume=this.musicVolume*(this.musicEnabled?1:0);
    if(!this.musicEnabled)this.pauseMusic();
    else this.startMusic();
  }
  musicCount(){return this.musicTracks.length;}
  hasMusic(){return this.musicTracks.length>0;}
  currentTrack(){return this.musicTracks[this.musicIndex]||null;}
  setMusicMode(mode="gameplay"){
    const nextMode=mode==="menu"?"menu":"gameplay";
    if(this.musicMode===nextMode)return;
    const currentStem=this.currentTrack()?.stem;
    this.musicMode=nextMode;
    this.musicTracks=nextMode==="menu"?this.menuMusicTracks:this.gameplayMusicTracks;
    const carryIndex=currentStem?this.musicTracks.findIndex((track)=>track.stem===currentStem):-1;
    this.musicIndex=carryIndex>=0?carryIndex:0;
    if(!this.musicEnabled){this.pauseMusic();return;}
    this.startMusic(true);
  }
  setMusicRate(rate=1){
    this.musicRate=clamp(Number.isFinite(rate)?rate:1,.75,1.4);
    if(!this.musicEl)return;
    this.musicEl.defaultPlaybackRate=this.musicRate;
    this.musicEl.playbackRate=this.musicRate;
    this.musicEl.preservesPitch=false;
    this.musicEl.webkitPreservesPitch=false;
    this.musicEl.mozPreservesPitch=false;
  }
  startMusic(force=false){
    if(!this.musicEnabled||!this.musicTracks.length)return;
    const track=this.currentTrack();if(!track)return;
    if(!this.musicEl){
      this.musicEl=new Audio();
      this.musicEl.preload="auto";
      this.musicEl.loop=false;
      this.musicEl.addEventListener("ended",()=>this.nextTrack());
    }
    const nextUrl=new URL(track.url,window.location.href).href;
    if(force||this.musicEl.src!==nextUrl){
      this.musicEl.src=track.url;
      this.musicEl.load();
    }
    this.musicEl.volume=this.musicVolume;
    this.setMusicRate(this.musicRate);
    this.musicEl.play().catch(()=>{});
  }
  pauseMusic(){
    if(!this.musicEl)return;
    this.musicEl.pause();
  }
  nextTrack(){
    if(!this.musicTracks.length)return;
    this.musicIndex=(this.musicIndex+1)%this.musicTracks.length;
    this.startMusic(true);
  }
  _playFile(name){
    const url=SFX_FILE_URLS[name];
    if(!url||!this.sfxEnabled)return false;
    const base=this.filePool[name]||(this.filePool[name]=new Audio(url));
    const clip=base.cloneNode();
    clip.volume=this.sfxVolume;
    clip.play().catch(()=>{});
    return true;
  }
  play(t){
    this.init();
    if(!this.sfxEnabled)return;
    if(this._playFile(t))return;
    if(!this.ctx)return;
    try{this._p(t);}catch(e){}
  }
  _p(t){
    const c=this.ctx, now=c.currentTime;
    switch(t){
      case "pickup":{
        // Bubbly pop â€” fast sweep up with harmonics
        this._sweep(300,900,.08,"sine",.2,0);
        this._sweep(600,1800,.06,"sine",.1,.02);
        this._t(1200,.04,"sine",.08,.06);
        break;
      }
      case "putdown":{
        // Soft thunk with reverb feel
        this._sweep(400,120,.12,"triangle",.18,0);
        this._t(80,.08,"sine",.12,.02);
        this._n(.04,.06,.03);
        break;
      }
      case "add":{
        // Cheerful bloop â€” pentatonic ascend
        const notes=[523,659,784];
        notes.forEach((f,i)=>{this._t(f,.06,"sine",.14,i*.04);this._t(f*2,.04,"sine",.05,i*.04);});
        break;
      }
      case "serve":{
        // Victory fanfare! Major chord arpeggio with shimmer
        const fan=[523,659,784,1047,1318,1568];
        fan.forEach((f,i)=>{
          this._t(f,.12,"square",.12,i*.05);
          this._t(f*1.005,.12,"square",.06,i*.05); // slight detune for richness
          this._t(f*2,.06,"sine",.04,i*.05+.02);
        });
        // Sparkle on top
        this._sweep(2000,4000,.15,"sine",.06,.25);
        this._sweep(3000,5000,.1,"sine",.04,.3);
        break;
      }
      case "combo":{
        // Epic ascending arpeggio with bass punch
        this._sweep(60,120,.15,"sine",.2,0); // bass drop
        const combo=[523,659,784,1047,1318,1568,2093];
        combo.forEach((f,i)=>{
          this._t(f,.1,"square",.1,i*.04);
          this._t(f*1.01,.1,"square",.05,i*.04);
        });
        // Shimmer cascade
        for(let i=0;i<5;i++) this._sweep(2000+i*400,4000+i*300,.08,"sine",.03,.3+i*.03);
        break;
      }
      case "fail":{
        // Comical wah-wah descend
        this._sweep(500,200,.2,"sawtooth",.12,0);
        this._sweep(480,180,.25,"sawtooth",.08,.05);
        this._t(120,.15,"triangle",.08,.2);
        break;
      }
      case "trash":{
        // Crumple + whoosh
        this._n(.15,.12,0);
        this._sweep(800,200,.1,"sawtooth",.06,.02);
        break;
      }
      case "process":{
        // Gentle percolating bubble
        this._sweep(600,900,.06,"sine",.08,0);
        this._t(1200,.03,"sine",.04,.04);
        break;
      }
      case "done":{
        // Ding ding! Bell-like with ring
        this._t(1397,.2,"sine",.15,0);  // F6
        this._t(1397*2,.15,"sine",.06,0);
        this._t(1760,.2,"sine",.12,.1); // A6
        this._t(1760*2,.12,"sine",.04,.1);
        // Little sparkle
        this._t(2637,.08,"sine",.05,.18);
        break;
      }
      case "step":{
        // Tiny soft tap â€” varies pitch slightly each time
        const pitch=180+Math.random()*60;
        this._t(pitch,.025,"triangle",.04,0);
        break;
      }
      case "warn":{
        // Attention! Two-note alert
        this._t(880,.08,"square",.08,0);
        this._t(660,.1,"square",.06,.1);
        this._t(880,.08,"square",.08,.2);
        break;
      }
      case "tick":{
        // Clock tick â€” crisp
        this._t(2400,.015,"sine",.06,0);
        this._t(1200,.01,"triangle",.03,.01);
        break;
      }
      case "neworder":{
        // Doorbell chime
        this._t(988,.1,"sine",.1,0);   // B5
        this._t(1319,.15,"sine",.12,.08); // E6
        break;
      }
    }
  }
  _t(f,d,ty,v,dl=0){
    const c=this.ctx,o=c.createOscillator(),g=c.createGain();
    o.type=ty;o.frequency.value=f;
    g.gain.setValueAtTime(v*.35,c.currentTime+dl);
    g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+dl+d);
    o.connect(g);g.connect(this.vol);o.start(c.currentTime+dl);o.stop(c.currentTime+dl+d+.05);
  }
  _sweep(f1,f2,d,ty,v,dl=0){
    const c=this.ctx,o=c.createOscillator(),g=c.createGain();
    o.type=ty;o.frequency.setValueAtTime(f1,c.currentTime+dl);
    o.frequency.exponentialRampToValueAtTime(f2,c.currentTime+dl+d);
    g.gain.setValueAtTime(v*.35,c.currentTime+dl);
    g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+dl+d);
    o.connect(g);g.connect(this.vol);o.start(c.currentTime+dl);o.stop(c.currentTime+dl+d+.05);
  }
  _n(d,v,dl=0){
    const c=this.ctx,b=c.createBuffer(1,c.sampleRate*d,c.sampleRate),dt=b.getChannelData(0);
    for(let i=0;i<dt.length;i++)dt[i]=(Math.random()*2-1)*.5;
    const s=c.createBufferSource();s.buffer=b;
    const g=c.createGain();g.gain.setValueAtTime(v*.35,c.currentTime+dl);
    g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+dl+d);
    // bandpass for nicer noise
    const flt=c.createBiquadFilter();flt.type="bandpass";flt.frequency.value=2000;flt.Q.value=.5;
    s.connect(flt);flt.connect(g);g.connect(this.vol);s.start(c.currentTime+dl);
  }
}
const sfx=new SFX();

// â”€â”€â”€ PARTICLES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
class Particles{
  constructor(){this.p=[];}
  emit(x,y,type,n=8){
    for(let i=0;i<n;i++){
      const a=(Math.PI*2/n)*i+Math.random()*.5,sp=1+Math.random()*2.5;
      let c,l,sz;
      if(type==="serve"){c=[P.gold,"#ffeb3b","#fff176",P.white][~~(Math.random()*4)];l=40+Math.random()*30;sz=2+Math.random()*3;}
      else if(type==="combo"){c=["#ff4081","#e040fb","#7c4dff","#448aff","#18ffff"][~~(Math.random()*5)];l=50+Math.random()*30;sz=3+Math.random()*3;}
      else if(type==="fail"){c=[P.red,"#ff6666","#ff8888"][~~(Math.random()*3)];l=25+Math.random()*15;sz=2+Math.random()*2;}
      else if(type==="steam"){c="#ffffff"+["88","66","44"][~~(Math.random()*3)];l=30+Math.random()*20;sz=2+Math.random()*2;}
      else if(type==="dust"){c=["#8b7355","#a0896a","#6b5533"][~~(Math.random()*3)];l=12+Math.random()*8;sz=1.5+Math.random()*1.5;}
      else{c=["#888","#666","#aaa"][~~(Math.random()*3)];l=20+Math.random()*10;sz=2+Math.random()*2;}
      const vy2=type==="steam"?-2:type==="dust"?-.5:0;
      this.p.push({x,y,vx:Math.cos(a)*sp*(type==="dust"?.4:1),vy:Math.sin(a)*sp*(type==="dust"?.3:1)+vy2,life:l,ml:l,sz,c,type});
    }
  }
  update(){this.p=this.p.filter(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=(p.type==="steam"?-.02:p.type==="dust"?-.01:.05);p.vx*=.97;return--p.life>0;});}
  draw(ctx){
    for(const p of this.p){const a=p.life/p.ml;ctx.globalAlpha=a;ctx.fillStyle=p.c;
      if(p.type==="serve"||p.type==="combo"){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.life*.1);const s=p.sz*a;ctx.fillRect(-s/2,-s/2,s,s);ctx.restore();}
      else ctx.fillRect(p.x-p.sz/2,p.y-p.sz/2,p.sz*a,p.sz*a);
    }ctx.globalAlpha=1;
  }
}

// â”€â”€â”€ DRAWING â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function drawChar(ctx,x,y,sz,clr,dir,f,squash){
  const sc=squash||{sx:1,sy:1};
  ctx.save();
  ctx.translate(x+sz/2,y+sz);
  ctx.scale(sc.sx,sc.sy);
  ctx.translate(-sz/2,-sz);
  const s=sz/16;
  const px=(a,b,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(a*s,b*s,w*s,h*s);};
  if(clr.type==="cat"){
    // cat body
    px(4,6,8,6,clr.apron);px(4,12,3,4,clr.pants);px(9,12,3,4,clr.pants);
    const l=Math.abs(Math.sin(f*.4))>.5;
    px(l?5:4,14,l?2:3,2,clr.shoes);px(l?9:9,14,l?2:3,2,clr.shoes);
    // cat head
    px(4,1,8,5,clr.fur);
    // ears
    px(3,-2,3,3,clr.fur);px(10,-2,3,3,clr.fur);
    px(4,-1,1,2,clr.earInner);px(11,-1,1,2,clr.earInner);
    // eyes
    if(dir==="up"){px(5,3,2,1,clr.main);px(9,3,2,1,clr.main);}
    else if(dir==="left"){px(4,3,2,2,"#332014");px(8,3,2,2,"#332014");}
    else if(dir==="right"){px(6,3,2,2,"#332014");px(10,3,2,2,"#332014");}
    else{px(5,3,2,2,"#332014");px(9,3,2,2,"#332014");px(6,3,1,1,P.white);px(10,3,1,1,P.white);}
    // nose
    px(7,4,2,1,clr.nose);
    // whiskers
    ctx.fillStyle=clr.fur+"88";ctx.fillRect(1*s,3.5*s,3*s,.5*s);ctx.fillRect(12*s,3.5*s,3*s,.5*s);
    // arms & apron tie
    px(1,7,3,2,clr.fur);px(12,7,3,2,clr.fur);px(6,7,4,1,P.white);px(7,8,2,3,clr.main);
    // tail
    const tailWag=Math.sin(f*.3)*1.5;
    ctx.fillStyle=clr.fur;ctx.fillRect((14+tailWag)*s,8*s,2*s,1*s);ctx.fillRect((15+tailWag)*s,7*s,1*s,2*s);
  }else if(clr.type==="girl"){
    // girl body with hair & bow
    px(4,6,8,6,clr.apron);px(4,12,3,4,clr.pants);px(9,12,3,4,clr.pants);
    const l=Math.abs(Math.sin(f*.4))>.5;
    px(l?5:4,14,l?2:3,2,clr.shoes);px(l?9:9,14,l?2:3,2,clr.shoes);
    px(4,1,8,5,clr.skin||P.skin);
    // hair (longer, flowing)
    px(3,-1,10,3,clr.hair||"#5a2810");px(4,-2,8,2,clr.hair||"#5a2810");
    px(3,1,1,5,clr.hair||"#5a2810");px(12,1,1,5,clr.hair||"#5a2810");
    // side hair strands
    px(2,3,2,4,clr.hair||"#5a2810");px(12,3,2,4,clr.hair||"#5a2810");
    // bow on top
    px(9,-2,2,1,clr.bow||"#e91e63");px(8,-1,1,1,clr.bow||"#e91e63");px(11,-1,1,1,clr.bow||"#e91e63");
    // eyes (slightly bigger/rounder)
    if(dir==="up"){px(5,3,2,1,clr.main);px(9,3,2,1,clr.main);}
    else if(dir==="left"){px(4,3,2,2,P.black);px(8,3,2,2,P.black);}
    else if(dir==="right"){px(6,3,2,2,P.black);px(10,3,2,2,P.black);}
    else{px(5,3,2,2,P.black);px(9,3,2,2,P.black);px(6,3,1,1,P.white);px(10,3,1,1,P.white);px(5,2,2,1,P.black);px(9,2,2,1,P.black);}
    // blush
    px(4,4,2,1,"#ffaaaa44");px(10,4,2,1,"#ffaaaa44");
    // arms & apron tie
    px(1,7,3,2,clr.skin||P.skin);px(12,7,3,2,clr.skin||P.skin);px(6,7,4,1,P.white);px(7,8,2,3,clr.main);
  }else if(clr.type==="chef"){
    // Gordon Ramsay parody - tall chef hat, angry eyebrows, white jacket
    px(4,6,8,6,clr.apron);px(4,12,3,4,clr.pants);px(9,12,3,4,clr.pants);
    const l=Math.abs(Math.sin(f*.4))>.5;
    px(l?5:4,14,l?2:3,2,clr.shoes);px(l?9:9,14,l?2:3,2,clr.shoes);
    px(4,1,8,5,clr.skin||P.skin);
    // tall chef hat (toque)
    px(4,-1,8,3,P.white);px(5,-4,6,3,P.white);px(6,-6,4,2,P.white);px(7,-7,2,1,P.white);
    // blonde/grey spiky hair peeking
    px(3,0,2,2,clr.hair);px(11,0,2,2,clr.hair);
    // angry eyebrows
    px(4,2,3,1,"#5a3018");px(9,2,3,1,"#5a3018");
    // eyes
    if(dir==="up"){px(5,3,2,1,clr.main);px(9,3,2,1,clr.main);}
    else{px(5,3,2,2,P.black);px(9,3,2,2,P.black);px(6,3,1,1,P.white);px(10,3,1,1,P.white);}
    // wrinkle lines
    if(clr.wrinkles){px(4,5,1,1,"#d4a06a44");px(11,5,1,1,"#d4a06a44");}
    // frown
    px(6,5,4,1,"#8d5a3b");
    // arms & apron tie
    px(1,7,3,2,clr.skin||P.skin);px(12,7,3,2,clr.skin||P.skin);px(6,7,4,1,"#cccccc");px(7,8,2,3,clr.main);
  }else if(clr.type==="robot"){
    // cute Wall-E style robot
    px(4,6,8,6,clr.apron||"#ffcc02");px(4,12,3,4,clr.pants);px(9,12,3,4,clr.pants);
    const l=Math.abs(Math.sin(f*.4))>.5;
    px(l?5:4,14,l?2:3,2,clr.shoes);px(l?9:9,14,l?2:3,2,clr.shoes);
    // boxy head
    px(3,0,10,6,clr.body||"#b0b8c0");px(4,1,8,4,clr.chest||"#78909c");
    // antenna
    px(7,-2,2,2,clr.body||"#b0b8c0");px(8,-3,1,1,clr.eye||"#4fc3f7");
    // big round eyes (binocular style)
    const blink=Math.sin(f*.06)>.95;
    if(blink){px(5,2,2,1,clr.eye);px(9,2,2,1,clr.eye);}
    else{px(5,2,2,2,clr.eye||"#4fc3f7");px(9,2,2,2,clr.eye||"#4fc3f7");px(5,2,1,1,"#fff");px(9,2,1,1,"#fff");}
    // eye frames
    px(4,1,4,1,clr.body);px(8,1,4,1,clr.body);px(4,4,4,1,clr.body);px(8,4,4,1,clr.body);
    // mouth - small happy line
    px(7,4,2,1,"#455a64");
    // mechanical arms
    px(1,7,3,2,clr.body||"#90a4ae");px(12,7,3,2,clr.body||"#90a4ae");
    // chest panel
    px(6,7,4,1,"#455a64");px(7,8,2,2,clr.eye||"#4fc3f7");
  }else{
    // human body (original)
    px(4,6,8,6,clr.apron);px(4,12,3,4,clr.pants);px(9,12,3,4,clr.pants);
    const l=Math.abs(Math.sin(f*.4))>.5;
    px(l?5:4,14,l?2:3,2,clr.shoes);px(l?9:9,14,l?2:3,2,clr.shoes);
    px(4,1,8,5,clr.skin||P.skin);
    // hat
    px(3,-2,10,3,clr.hat||P.white);px(5,-4,6,2,clr.hat||P.white);px(6,-5,4,1,clr.hat||P.white);
    // eyes
    if(dir==="up"){px(5,3,2,1,clr.main);px(9,3,2,1,clr.main);}
    else if(dir==="left"){px(4,3,2,2,P.black);px(8,3,2,2,P.black);}
    else if(dir==="right"){px(6,3,2,2,P.black);px(10,3,2,2,P.black);}
    else{px(5,3,2,2,P.black);px(9,3,2,2,P.black);px(6,3,1,1,P.white);px(10,3,1,1,P.white);}
    // arms & apron tie
    px(1,7,3,2,clr.skin||P.skin);px(12,7,3,2,clr.skin||P.skin);px(6,7,4,1,P.white);px(7,8,2,3,clr.main);
  }
  ctx.restore();
}

function drawRushTrail(ctx,x,y,sz,dir,f,moving){
  const [dr,dc]=DIRS[dir]||DIRS.right;
  const pulse=(Math.sin(f*.32)+1)/2;
  ctx.save();
  ctx.globalAlpha=(moving ? .24 : .16)+pulse*.06;
  ctx.fillStyle="#ffe5a3";
  ctx.fillRect(x+sz*.14,y+sz*.28,sz*.72,sz*.54);

  const layers=moving?4:2;
  for(let i=0;i<layers;i++){
    const alpha=Math.max(.04,(moving ? .18 : .1)-i*.03+pulse*.02);
    ctx.globalAlpha=alpha;
    ctx.fillStyle=i===0?"#fff6c8":i===1?"#ffd36f":"#ffae42";
    if(Math.abs(dc)>0){
      const streakW=sz*(.5+i*.28);
      const streakH=3+i;
      const trailX=dc>0?x-streakW-(5+i*4):x+sz+(5+i*4);
      const trailY=y+sz*.5-streakH/2+(i%2===0?-1:1)*(moving?2:1);
      ctx.fillRect(trailX,trailY,streakW,streakH);
      ctx.fillRect(trailX,trailY+6+i,streakW*.72,streakH);
    }else{
      const streakW=3+i;
      const streakH=sz*(.5+i*.28);
      const trailX=x+sz*.5-streakW/2+(i%2===0?-1:1)*(moving?2:1);
      const trailY=dr>0?y-streakH-(4+i*4):y+sz+(4+i*4);
      ctx.fillRect(trailX,trailY,streakW,streakH);
      ctx.fillRect(trailX+6+i,trailY,streakW,streakH*.72);
    }
  }
  ctx.restore();
}

function drawCup(ctx,x,y,sz,ings){
  const s=sz/12;
  const px=(a,b,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x+a*s,y+b*s,w*s,h*s);};
  px(1,2,10,8,P.cupW);px(2,1,8,1,P.cupR);px(0,10,12,1,P.cupR);
  if(ings.length){const seg=Math.floor(7/Math.max(ings.length,1));ings.forEach((ing,i)=>{const iy=3+i*seg;px(2,iy,8,Math.min(seg,7-i*seg),ING_C[ing]||"#888");});}
  px(11,4,2,1,P.cupR);px(12,5,1,3,P.cupR);px(11,8,2,1,P.cupR);
}

function getRecipeUiColor(drink){
  if(drink==="Espresso")return "#d9b89a";
  if(drink==="Double Espresso")return "#c79f7c";
  if(drink==="Hot Tea")return "#d9a66d";
  return RECIPES[drink]?.clr||"#e8a87c";
}

function drawCentralPerksWindowScene(ctx,x,y,w,h,f,paneIdx){
  const sky=ctx.createLinearGradient(x,y,x,y+h);
  sky.addColorStop(0,"#d7e9f7");
  sky.addColorStop(.48,"#b9d1e4");
  sky.addColorStop(1,"#8eaac1");
  ctx.fillStyle=sky;
  ctx.fillRect(x,y,w,h);

  const sunX=x+w*(.16+paneIdx*.17);
  const sunY=y+h*.18;
  const sun=ctx.createRadialGradient(sunX,sunY,0,sunX,sunY,w*.2);
  sun.addColorStop(0,"rgba(255,236,188,0.24)");
  sun.addColorStop(.65,"rgba(255,236,188,0.08)");
  sun.addColorStop(1,"rgba(255,240,196,0)");
  ctx.fillStyle=sun;
  ctx.fillRect(x,y,w,h*.5);

  for(let i=0;i<2;i++){
    const drift=((f*(.28+i*.06))+paneIdx*29+i*41)%(w+26)-26;
    const cy=y+h*(.12+i*.13)+Math.sin((f+i*17+paneIdx*9)*.04)*2;
    ctx.fillStyle=i===0?"#ffffff78":"#f7fbff5e";
    ctx.fillRect(x+drift,cy,w*.18,h*.05);
    ctx.fillRect(x+drift+w*.03,cy-h*.02,w*.1,h*.04);
    ctx.fillRect(x+drift+w*.08,cy+h*.02,w*.08,h*.03);
  }

  const skylineBase=y+h*.68;
  ctx.fillStyle="#c5d3df";
  ctx.fillRect(x,skylineBase,w,h*.08);

  for(let i=0;i<4;i++){
    const bx=x+4+i*(w/4.3);
    const bw=Math.max(4,w*(.11+.02*((i+paneIdx)%2)));
    const bh=h*(.18+.1*((i+paneIdx)%3));
    ctx.fillStyle=["#8ea2b6","#8295ab","#768ba1","#a2b5c8"][(i+paneIdx)%4];
    ctx.fillRect(bx,skylineBase-bh,bw,bh+2);
    ctx.fillStyle="#edf7ff";
    ctx.fillRect(bx+1,skylineBase-bh+2,1,1);
    ctx.fillRect(bx+bw-2,skylineBase-bh+5,1,1);
    if(i%2===0)ctx.fillRect(bx+Math.max(2,bw-3),skylineBase-bh+8,1,1);
  }

  for(let i=0;i<3;i++){
    const bx=x+8+i*(w/3.4);
    const bw=Math.max(5,w*(.16+.025*((i+paneIdx)%2)));
    const bh=h*(.28+.12*((i+paneIdx*2)%3));
    ctx.fillStyle=["#5f7389","#54687d","#72879f","#495c71"][(i+paneIdx)%4];
    ctx.fillRect(bx,skylineBase-bh,bw,bh+2);
    ctx.fillStyle="#f7fbff";
    for(let wy=4;wy<bh-4;wy+=4){
      ctx.fillRect(bx+2,skylineBase-bh+wy,1,1);
      if(bw>6)ctx.fillRect(bx+bw-3,skylineBase-bh+wy+1,1,1);
    }
  }

  const avenueY=y+h*.82;
  ctx.fillStyle="#75808a";
  ctx.fillRect(x+3,avenueY,w-6,2);
  ctx.fillStyle="#aeb9c2";
  for(let i=0;i<6;i++)ctx.fillRect(x+6+i*(w/6),avenueY+3,Math.max(3,w*.06),1);

  const carSpan=Math.max(18,w-18);
  const carA=(f*1.55+paneIdx*19)%carSpan;
  const carB=(carSpan-((f*1.2+paneIdx*13)%carSpan));
  const carC=(f*.95+paneIdx*31)%carSpan;
  const drawCar=(cx,cy,body,roof)=>{
    ctx.fillStyle=body;
    ctx.fillRect(cx,cy,6,2);
    ctx.fillStyle=roof;
    ctx.fillRect(cx+1,cy-1,4,1);
    ctx.fillStyle="#eef7ff";
    ctx.fillRect(cx+1,cy,1,1);
    ctx.fillRect(cx+4,cy,1,1);
  };
  drawCar(x+7+carA,avenueY-1,"#d9784f","#f7d9c5");
  drawCar(x+7+carB,avenueY+2,"#f0c989","#fff0d2");
  drawCar(x+7+carC,avenueY+5,"#2d655d","#d7efe9");

  const birdX=x+((f*1.8+paneIdx*23)%(w+18))-9;
  const birdY=y+8+Math.sin((f+paneIdx*20)*.06)*3;
  ctx.fillStyle="#4a627b";
  ctx.fillRect(birdX,birdY,3,1);
  ctx.fillRect(birdX+4,birdY,3,1);
  ctx.fillRect(birdX+1,birdY-1,1,1);
  ctx.fillRect(birdX+5,birdY-1,1,1);

  ctx.fillStyle="#ffffff14";
  ctx.fillRect(x+3,y+3,w*.22,2);
  ctx.fillRect(x+w*.68,y+5,w*.12,2);
}

function drawCentralPerksBlackboard(ctx,x,y,w,h,title="HOUSE MENU"){
  ctx.fillStyle="#6a4739";
  ctx.fillRect(x-3,y-3,w+6,h+6);
  ctx.fillStyle="#2b3126";
  ctx.fillRect(x,y,w,h);
  ctx.strokeStyle="#c79d6d";
  ctx.lineWidth=2;
  ctx.strokeRect(x+.5,y+.5,w-1,h-1);

  ctx.fillStyle="#efe3d1";
  ctx.font=`bold ${Math.max(8,h*.18)}px monospace`;
  ctx.textAlign="left";
  ctx.fillText(title,x+8,y+10);

  ctx.fillStyle="#f0c989";
  ctx.fillRect(x+8,y+17,12,1);
  ctx.fillRect(x+12,y+13,4,1);
  ctx.fillRect(x+12,y+18,4,1);
  ctx.fillRect(x+10,y+19,10,5);
  ctx.fillStyle="#efe3d1";
  ctx.fillRect(x+11,y+10,2,4);
  ctx.fillRect(x+15,y+8,2,5);
  ctx.fillRect(x+19,y+10,2,4);
  ctx.fillRect(x+16,y+24,4,1);

  const lineX=x+34;
  const widths=[w*.34,w*.28,w*.31,w*.23,w*.18];
  widths.forEach((lineW,idx)=>{
    ctx.fillStyle=idx===1?"#f0c989":"#f5efe6";
    ctx.fillRect(lineX,y+12+idx*5,Math.max(12,lineW),1);
    ctx.fillRect(lineX+Math.max(14,lineW)+4,y+12+idx*5,Math.max(4,w*.06),1);
  });
}

function drawCentralPerksLoungeProps(ctx,T,BW,BH,f){
  const areaY=BH-T*.78;
  const couchY=areaY+T*.14;
  const couchW=T*3.15;
  const couchH=T*.42;
  const couchX=BW/2-couchW/2;
  const cushionShift=Math.sin(f*.04)*1.5;

  ctx.fillStyle="#5c362d";
  ctx.fillRect(couchX+T*.12,couchY+couchH+T*.09,couchW-T*.24,T*.08);
  ctx.fillStyle="#c96e46";
  ctx.fillRect(couchX,couchY+T*.08,couchW,couchH);
  ctx.fillRect(couchX-T*.14,couchY+T*.12,T*.22,couchH+T*.08);
  ctx.fillRect(couchX+couchW-T*.08,couchY+T*.12,T*.22,couchH+T*.08);
  ctx.fillStyle="#d88658";
  ctx.fillRect(couchX+T*.08,couchY+T*.14,couchW-T*.16,T*.12);
  ctx.fillRect(couchX+T*.08,couchY+T*.34,couchW-T*.16,T*.1);
  ctx.fillStyle="#b45b39";
  ctx.fillRect(couchX+T*.2,couchY+T*.25,T*.55,T*.18);
  ctx.fillRect(couchX+T*.95,couchY+T*.24+cushionShift*.02,T*.62,T*.19);
  ctx.fillRect(couchX+T*1.75,couchY+T*.25-cushionShift*.02,T*.62,T*.18);
  ctx.fillStyle="#f2dec6";
  ctx.fillRect(couchX+T*2.44,couchY+T*.24,T*.28,T*.14);
  ctx.fillStyle="#c09ea7";
  ctx.fillRect(couchX+T*.5,couchY+T*.18,T*.22,T*.06);
  ctx.fillRect(couchX+T*1.95,couchY+T*.18,T*.22,T*.06);

  const tableX=BW/2-T*.62;
  const tableY=areaY+T*.42;
  ctx.fillStyle="#314544";
  ctx.fillRect(tableX,tableY,T*1.24,T*.16);
  ctx.fillStyle="#253434";
  ctx.fillRect(tableX+T*.12,tableY+T*.16,T*1.0,T*.06);
  ctx.fillStyle="#5f4034";
  ctx.fillRect(tableX+T*.12,tableY+T*.22,T*.08,T*.18);
  ctx.fillRect(tableX+T*1.04,tableY+T*.22,T*.08,T*.18);
  ctx.fillStyle="#fff4e2";
  ctx.fillRect(tableX+T*.22,tableY-T*.04,T*.12,T*.12);
  ctx.fillRect(tableX+T*.75,tableY-T*.04,T*.12,T*.12);
  ctx.fillStyle="#c9784f";
  ctx.fillRect(tableX+T*.25,tableY-T*.01,T*.06,T*.05);
  ctx.fillRect(tableX+T*.78,tableY-T*.01,T*.06,T*.05);

  const leftChairX=T*.42;
  const chairY=areaY+T*.18;
  ctx.fillStyle="#7c2030";
  ctx.fillRect(leftChairX,chairY,T*.7,T*.34);
  ctx.fillRect(leftChairX+T*.08,chairY+T*.34,T*.54,T*.12);
  ctx.fillStyle="#5c362d";
  ctx.fillRect(leftChairX+T*.12,chairY+T*.46,T*.08,T*.2);
  ctx.fillRect(leftChairX+T*.5,chairY+T*.46,T*.08,T*.2);
  ctx.fillStyle="#f0d6b8";
  ctx.fillRect(leftChairX+T*.18,chairY+T*.12,T*.12,T*.08);
  ctx.fillRect(leftChairX+T*.38,chairY+T*.1,T*.1,T*.06);

  const standX=BW-T*1.35;
  const standY=areaY+T*.12;
  ctx.fillStyle="#214844";
  ctx.fillRect(standX,standY,T*.42,T*.5);
  ctx.fillStyle="#2d655d";
  ctx.fillRect(standX-T*.06,standY+T*.1,T*.54,T*.06);
  ctx.fillRect(standX-T*.06,standY+T*.24,T*.54,T*.06);
  ctx.fillRect(standX-T*.06,standY+T*.38,T*.54,T*.06);
  ctx.fillStyle="#f5e7d0";
  ctx.fillRect(standX+T*.04,standY+T*.04,T*.18,T*.1);
  ctx.fillRect(standX+T*.2,standY+T*.18,T*.16,T*.08);
  ctx.fillRect(standX+T*.1,standY+T*.32,T*.2,T*.08);
  ctx.fillStyle="#d9784f";
  ctx.fillRect(standX+T*.07,standY+T*.08,T*.12,2);
  ctx.fillRect(standX+T*.22,standY+T*.22,T*.1,2);
  ctx.fillRect(standX+T*.13,standY+T*.36,T*.14,2);

  const guitarX=T*.2;
  const guitarY=areaY+T*.2;
  ctx.fillStyle="#9e652e";
  ctx.fillRect(guitarX+T*.24,guitarY,T*.06,T*.26);
  ctx.fillRect(guitarX+T*.22,guitarY-T*.08,T*.1,T*.08);
  ctx.fillStyle="#cf8a41";
  ctx.fillRect(guitarX+T*.14,guitarY+T*.22,T*.22,T*.24);
  ctx.fillStyle="#f3d799";
  ctx.fillRect(guitarX+T*.22,guitarY+T*.3,T*.06,T*.06);
  ctx.fillStyle="#5f4034";
  ctx.fillRect(guitarX+T*.19,guitarY+T*.12,2,T*.18);
}

function drawCafeDecor(ctx,T,BW,BH,f){
  const mapTheme=getActiveMapDef().theme||{};
  ctx.save();
  const topH=T*.75;
  ctx.fillStyle=mapTheme.top||"#201108";
  ctx.fillRect(0,0,BW,topH);

  if(mapTheme.deco==="centralperks"){
    const winY=T*.04,winH=T*.36,pad=T*.4,paneGap=T*.08,paneW=(BW-pad*2-paneGap*3)/4;
    for(let i=0;i<4;i++){
      const px=pad+i*(paneW+paneGap);
      ctx.fillStyle="#2f5d5a";
      ctx.fillRect(px,winY,paneW,winH);
      drawCentralPerksWindowScene(ctx,px+2,winY+2,paneW-4,winH-4,f,i);
      ctx.fillStyle="#325452";
      ctx.fillRect(px+paneW*.48,winY,2,winH);
      ctx.fillRect(px,winY+winH*.46,paneW,2);
    }

    ctx.fillStyle="#7b2030";
    ctx.fillRect(BW/2-T*1.65,T*.03,T*3.3,T*.18);
    ctx.fillStyle="#f7dfb3";
    ctx.fillRect(BW/2-T*.52,T*.05,T*1.04,T*.14);
    ctx.fillStyle="#214844";
    ctx.font=`bold ${Math.max(10,T*.15)}px monospace`;
    ctx.textAlign="center";
    ctx.fillText(mapTheme.logo||"CENTRAL PERKS",BW/2,T*.17);
    ctx.fillStyle="#fff4e2";
    ctx.font=`${Math.max(7,T*.1)}px monospace`;
    ctx.fillText(mapTheme.subtitle||"SKYLINE BREWS",BW/2,T*.31);
  }else{
    const menuX=T*2.1,menuY=T*.04,menuW=BW-T*4.2,menuH=T*.38;
    ctx.fillStyle=mapTheme.wood||"#3a2618";
    ctx.fillRect(menuX-4,menuY-4,menuW+8,menuH+8);
    ctx.fillStyle=mapTheme.panel||"#223329";
    ctx.fillRect(menuX,menuY,menuW,menuH);
    ctx.strokeStyle=mapTheme.trim||"#a37b42";
    ctx.lineWidth=2;
    ctx.strokeRect(menuX+.5,menuY+.5,menuW-1,menuH-1);
    ctx.fillStyle=mapTheme.text||"#f2e2c6";
    ctx.font=`bold ${Math.max(10,T*.15)}px monospace`;
    ctx.textAlign="center";
    ctx.fillText(mapTheme.logo||"HOUSE SPECIALS",BW/2,menuY+T*.14);
    ctx.font=`${Math.max(7,T*.1)}px monospace`;
    ctx.fillStyle=mapTheme.accent||"#b6d5b5";
    ctx.fillText(mapTheme.subtitle||"LATTE  MATCHA  CARAMEL  TEA",BW/2,menuY+T*.3);
  }

  const lightXs=PENDANT_COLS.map((n)=>n*T);
  lightXs.forEach((lx,idx)=>{
    const sway=Math.sin(f*.02+idx)*1.5;
    ctx.strokeStyle=mapTheme.wood||"#7b5b2c";
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.moveTo(lx,0);
    ctx.lineTo(lx+sway,T*.18);
    ctx.stroke();
    ctx.fillStyle=mapTheme.lamp||"#d8a73a";
    ctx.fillRect(lx-7+sway,T*.18,14,8);
    ctx.fillStyle=`rgba(${mapTheme.glow||"255,224,138"},0.16)`;
    ctx.beginPath();
    ctx.moveTo(lx-26+sway,T*.26);
    ctx.lineTo(lx+26+sway,T*.26);
    ctx.lineTo(lx+12+sway,T*.78);
    ctx.lineTo(lx-12+sway,T*.78);
    ctx.closePath();
    ctx.fill();
  });

  if(mapTheme.deco!=="centralperks"){
    ctx.fillStyle=mapTheme.shelf||"#4f311f";
    ctx.fillRect(T*.45,topH-T*.12,T*1.2,T*.12);
    ctx.fillRect(BW-T*1.65,topH-T*.12,T*1.2,T*.12);
    ctx.fillStyle=mapTheme.accent||"#5b8d46";
    ctx.fillRect(T*.6,topH-T*.42,T*.9,T*.3);
    ctx.fillRect(BW-T*1.5,topH-T*.46,T*.9,T*.34);
    ctx.fillStyle="#d9f4de";
    ctx.fillRect(T*.7,topH-T*.52,T*.3,T*.14);
    ctx.fillRect(BW-T*1.25,topH-T*.6,T*.28,T*.16);
  }

  if(mapTheme.deco==="sunbooks"){
    ctx.fillStyle="#f4e8cf";
    ctx.fillRect(T*.58,T*.14,T*.72,T*.18);
    ctx.fillStyle=mapTheme.accent||"#5ab97f";
    ctx.beginPath();ctx.arc(T*.94,T*.23,T*.17,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#f4fbf5";
    ctx.fillRect(T*.87,T*.16,T*.05,T*.14);
    ctx.fillRect(T*.96,T*.16,T*.05,T*.14);
    ctx.fillRect(T*.91,T*.17,T*.05,T*.1);
    for(let i=0;i<5;i++){
      ctx.fillStyle=["#d8b48c","#8ec7a0","#f1d17a","#9bc2ff","#d7a0ff"][i%5];
      ctx.fillRect(BW-T*(1.8+i*.12),T*.06+i*2,T*.09,T*.22);
    }
  }else if(mapTheme.deco==="catcafe"){
    ctx.fillStyle="#2f241e";
    ctx.fillRect(T*.56,T*.08,T*1.32,T*.28);
    ctx.strokeStyle="#f4d39c";
    ctx.lineWidth=2;
    ctx.strokeRect(T*.56+.5,T*.08+.5,T*1.32-1,T*.28-1);
    ctx.fillStyle="#fff3df";
    for(let i=0;i<4;i++){
      ctx.fillRect(T*.7,T*.13+i*T*.045,T*.86-(i%2)*T*.12,2);
    }
    ctx.fillStyle="#f4d39c";
    ctx.beginPath();ctx.arc(T*1.06,T*.22,T*.12,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#5a3a34";
    ctx.fillRect(T*.99,T*.19,T*.03,T*.04);
    ctx.fillRect(T*1.1,T*.19,T*.03,T*.04);
    ctx.fillRect(T*1.04,T*.24,T*.05,T*.02);
    ctx.fillStyle="#7aa9d8";
    ctx.fillRect(BW-T*1.85,T*.08,T*1.05,T*.28);
    ctx.fillStyle="#dff4ff";
    ctx.fillRect(BW-T*1.8,T*.1,T*.95,T*.24);
    ctx.fillStyle="#a7d5ea";
    ctx.fillRect(BW-T*1.68,T*.13,T*.71,T*.09);
    ctx.fillStyle="#6b8f6b";
    ctx.fillRect(BW-T*1.63,T*.24,T*.18,T*.06);
    ctx.fillRect(BW-T*1.34,T*.22,T*.12,T*.08);
    ctx.fillStyle="#5b3d32";
    ctx.fillRect(BW-T*1.58,T*.06,T*.03,T*.32);
    ctx.fillRect(BW-T*1.17,T*.06,T*.03,T*.32);
    ctx.fillRect(BW-T*1.79,T*.2,T*.98,T*.03);
    ctx.fillStyle="#f7d7ab";
    for(let i=0;i<4;i++){
      const lx=T*.55+i*T*.34;
      ctx.fillRect(lx,T*.03,T*.06,T*.06);
      ctx.fillRect(lx+T*.02,T*.1,T*.02,T*.02);
    }
  }else if(mapTheme.deco==="centralperks"){
    drawCentralPerksBlackboard(ctx,T*.46,topH-T*.43,T*2.65,T*.34,"ESPRESSO");
    drawCentralPerksBlackboard(ctx,BW-T*3.11,topH-T*.43,T*2.65,T*.34,"SPECIALS");
    ctx.fillStyle="#214844";
    ctx.fillRect(T*.42,topH-T*.11,T*1.55,3);
    ctx.fillRect(BW-T*1.97,topH-T*.11,T*1.55,3);
    ctx.fillStyle="#d9784f";
    ctx.fillRect(T*.38,topH-T*.26,T*.18,T*.17);
    ctx.fillRect(BW-T*.56,topH-T*.26,T*.18,T*.17);
    ctx.fillStyle="#f3e5d0";
    ctx.fillRect(T*.43,topH-T*.21,T*.08,T*.06);
    ctx.fillRect(BW-T*.51,topH-T*.21,T*.08,T*.06);
  }else if(mapTheme.deco==="halloween"){
    // chalkboard menu with spooky items
    ctx.fillStyle="#1a0a18";
    ctx.fillRect(T*.56,T*.06,T*1.4,T*.3);
    ctx.strokeStyle="#ff8c00";ctx.lineWidth=1.5;
    ctx.strokeRect(T*.56+.5,T*.06+.5,T*1.4-1,T*.3-1);
    ctx.fillStyle="#ffe0b0";
    ctx.font=`bold ${Math.max(7,T*.09)}px monospace`;ctx.textAlign="left";
    const spookyItems=["WITCH BREW","BOO LATTE","PUMPKIN SPICE"];
    spookyItems.forEach((item,i)=>{ctx.fillText(item,T*.66,T*.14+i*T*.08);});
    // skull on shelf
    ctx.fillStyle="#f5e6d3";
    ctx.fillRect(BW-T*1.65,topH-T*.3,T*.18,T*.14);
    ctx.fillRect(BW-T*1.61,topH-T*.38,T*.1,T*.1);
    ctx.fillStyle="#1a0a18";
    ctx.fillRect(BW-T*1.62,topH-T*.26,T*.04,T*.04);
    ctx.fillRect(BW-T*1.54,topH-T*.26,T*.04,T*.04);
    // potion bottle
    ctx.fillStyle="#9b30ff88";
    ctx.fillRect(T*.62,topH-T*.36,T*.12,T*.22);
    ctx.fillStyle="#4a1040";ctx.fillRect(T*.64,topH-T*.4,T*.08,T*.06);
  }else if(mapTheme.deco==="winter"){
    // cozy chalkboard menu
    ctx.fillStyle="#2a1810";
    ctx.fillRect(T*.56,T*.06,T*1.4,T*.3);
    ctx.strokeStyle="#cc2222";ctx.lineWidth=1.5;
    ctx.strokeRect(T*.56+.5,T*.06+.5,T*1.4-1,T*.3-1);
    ctx.fillStyle="#f0f4ff";
    ctx.font=`bold ${Math.max(7,T*.09)}px monospace`;ctx.textAlign="left";
    const winterItems=["HOT COCOA","EGGNOG LATTE","GINGERBREAD"];
    winterItems.forEach((item,i)=>{ctx.fillText(item,T*.66,T*.14+i*T*.08);});
    // stocking on shelf
    ctx.fillStyle="#cc2222";ctx.fillRect(BW-T*1.6,topH-T*.36,T*.12,T*.2);
    ctx.fillStyle="#fff";ctx.fillRect(BW-T*1.62,topH-T*.36,T*.16,T*.06);
    // snow globe
    ctx.fillStyle="#5a4030";ctx.fillRect(T*.64,topH-T*.28,T*.14,T*.04);
    ctx.fillStyle="#b8d6ef66";
    ctx.beginPath();ctx.arc(T*.71,topH-T*.36,T*.08,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#fff";ctx.fillRect(T*.69,topH-T*.33,T*.02,T*.02);
  }else if(mapTheme.deco==="eid"){
    // ornate golden frame with calligraphy
    ctx.fillStyle="#0a1830";
    ctx.fillRect(T*.56,T*.06,T*1.4,T*.3);
    ctx.strokeStyle="#d4af37";ctx.lineWidth=2;
    ctx.strokeRect(T*.56+.5,T*.06+.5,T*1.4-1,T*.3-1);
    ctx.strokeRect(T*.56+3,T*.06+3,T*1.4-6,T*.3-6);
    ctx.fillStyle="#fff8e0";
    ctx.font=`bold ${Math.max(7,T*.09)}px monospace`;ctx.textAlign="left";
    const eidItems=["ARABIC COFFEE","CARDAMOM TEA","DATES SHAKE"];
    eidItems.forEach((item,i)=>{ctx.fillText(item,T*.66,T*.14+i*T*.08);});
    // decorative vase on shelf
    ctx.fillStyle="#40bfa0";ctx.fillRect(BW-T*1.58,topH-T*.34,T*.14,T*.2);
    ctx.fillStyle="#d4af37";ctx.fillRect(BW-T*1.6,topH-T*.36,T*.18,T*.04);
    ctx.fillRect(BW-T*1.6,topH-T*.16,T*.18,T*.04);
    // fanoos lantern on other shelf
    ctx.fillStyle="#d4af37";ctx.fillRect(T*.64,topH-T*.38,T*.1,T*.22);
    ctx.fillStyle="#ff880066";ctx.fillRect(T*.65,topH-T*.34,T*.08,T*.14);
  }else if(mapTheme.deco==="pixelperk"){
    ctx.fillStyle="#211229";
    ctx.fillRect(T*.52,T*.1,T*.96,T*.24);
    ctx.strokeStyle=mapTheme.trim||"#62e6d6";
    ctx.lineWidth=2;
    ctx.strokeRect(T*.52+.5,T*.1+.5,T*.96-1,T*.24-1);
    ctx.fillStyle=mapTheme.trim||"#62e6d6";
    ctx.fillText("INSERT COIN",T, T*.28);
    ctx.fillStyle="#ff8f5a";
    ctx.fillRect(BW-T*1.7,T*.08,T*.4,T*.18);
    ctx.fillStyle="#ffd6c5";
    ctx.fillRect(BW-T*1.64,T*.12,T*.1,T*.1);
    ctx.fillRect(BW-T*1.48,T*.12,T*.1,T*.1);
  }
  ctx.restore();
}

function drawSt(ctx,x,y,T,key,f){
  const st=STATIONS[key];if(!st)return;const s=T/16;
  const mapTheme=getActiveMapDef().theme||{};
  const px=(a,b,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x+a*s,y+b*s,w*s,h*s);};
  const isCatCafe=mapTheme.deco==="catcafe";
  const isCentralPerks=mapTheme.deco==="centralperks";
  const isHalloween=mapTheme.deco==="halloween";
  const isWinter=mapTheme.deco==="winter";
  const isEid=mapTheme.deco==="eid";
  const shell=isCatCafe?"#6b473c":isCentralPerks?"#7b5848":isHalloween?"#4a1838":isWinter?"#5a4a3a":isEid?"#5a3828":P.wallHi;
  const panel=isCatCafe?"#2d1913":isCentralPerks?"#eadcc7":isHalloween?"#2a1030":isWinter?"#1e3050":isEid?"#1a3050":"#2a1608";
  px(0,0,16,16,shell);px(1,1,14,14,panel);
  // edge highlights
  px(0,0,16,1,shell);px(1,1,14,1,isCatCafe?"#8a6050":isCentralPerks?"#9a7868":isHalloween?"#6a2848":isWinter?"#6a5a48":isEid?"#6a4838":"#3a2010");
  px(1,14,14,1,isCatCafe?"#4a2820":isCentralPerks?"#c4b4a0":isHalloween?"#1a0820":isWinter?"#3a302a":isEid?"#4a2818":"#1a0a04");
  px(0,0,1,16,isCatCafe?"#7a5544":isCentralPerks?"#8a6858":isHalloween?"#5a2040":isWinter?"#5a4a38":isEid?"#5a3828":"#3a2215");
  px(15,0,1,16,isCatCafe?"#5a3830":isCentralPerks?"#6a5040":isHalloween?"#2a1028":isWinter?"#3a302a":isEid?"#4a2818":"#1a0c06");
  if(isCatCafe){
    px(2,2,12,1,"#f2dfc5");
    px(2,13,12,1,"#7d5845");
  }else if(isCentralPerks){
    px(2,2,12,1,"#2d655d");
    px(2,13,12,1,"#744b3f");
  }
  switch(st.id){
    case"espresso":case"espresso2":{
      const pulse=.5+.5*Math.sin(f*.04);
      const pour=4+Math.max(0,Math.sin(f*.028))*4;
      // machine body - metallic
      px(3,3,10,1,"#6a6a6a");px(3,4,10,7,"#4b4b4b");px(3,10,10,1,"#383838");
      px(4,4,8,6,"#3a3a3a");px(4,4,8,1,"#444");
      px(3,3,1,8,"#5a5a5a");px(12,3,1,8,"#333");
      // chrome details
      px(5,5,1,2,"#9a9a9a");px(10,5,1,2,"#9a9a9a");
      px(5,5,6,1,`rgba(255,214,102,${.3+pulse*.45})`);
      px(6,6,4,1,`rgba(255,190,80,${.15+pulse*.25})`);
      // drip spout
      px(5,11,6,1,"#7a7a7a");px(5,12,6,1,"#5a5a5a");
      px(7,10,2,pour,"#8b4f1d");
      // coffee tank
      px(6,11,4,3,P.esp);px(6,11,4,1,"#5a3010");px(7,12,2,1,"#2a1008");
      // steam
      if(Math.sin(f*.032)>0.35){px(7,1,1,2,"#fff6");px(9,2,1,1,"#fff4");}
      if(Math.sin(f*.05)>0.5){px(5,2,1,1,"#fff3");px(11,1,1,1,"#fff2");}
      break;
    }
    case"steamer":{
      px(4,4,8,8,"#d4d4d4");px(5,5,6,6,"#e2e2e2");
      px(4,4,8,1,"#eee");px(4,11,8,1,"#aaa");
      px(4,4,1,8,"#ccc");px(11,4,1,8,"#b0b0b0");
      // gauge
      px(6,6,4,1,"#888");px(6,6,2,1,"#4caf50");
      // steam vents
      const sv=Math.sin(f*.04);
      if(sv>0){px(6,2,1,2,"#fff8");px(9,1,1,3,"#fff6");}
      if(sv>0.4){px(7,1,1,2,"#fff4");}
      break;
    }
    case"milk":{
      px(4,3,8,10,"#f5efe0");px(5,4,6,8,P.milk);
      px(4,3,8,1,"#faf5ea");px(4,12,8,1,"#d8d0c0");
      px(4,3,1,10,"#ede5d4");px(11,3,1,10,"#d4c8b2");
      px(5,2,6,1,"#e8dcc0");px(5,4,6,2,"#d4c8a8");
      // milk line
      px(6,5,4,1,"#ffffff44");
      break;
    }
    case"foam":{
      px(3,5,10,7,P.cupW);px(3,5,10,1,"#fff");px(3,11,10,1,"#d8d0c4");
      // foam mound
      px(4,3,8,3,P.foam);px(5,2,6,2,P.foam);px(6,1,4,1,"#fffef8");
      px(5,2,2,2,P.foam);px(9,2,2,2,P.foam);
      px(6,3,1,1,"#fff");px(9,2,1,1,"#fff");
      break;
    }
    case"ice":{
      px(3,4,4,5,P.ice);px(9,6,4,5,P.ice);
      px(5,3,3,3,P.iceS);px(8,5,3,3,P.iceS);
      // crystal highlights
      px(4,4,1,1,"#fff");px(10,6,1,1,"#fff");
      px(6,5,1,1,"#ffffff88");px(9,8,1,1,"#ffffff88");
      // extra cube
      px(6,8,3,3,P.ice);px(7,7,2,2,P.iceS);
      break;
    }
    case"caramel":{
      px(4,3,8,9,"#d4960e");px(5,4,6,7,P.car);
      px(4,3,8,1,"#e0a820");px(4,11,8,1,"#905a08");
      px(5,2,6,2,"#daa010");px(5,2,6,1,"#e8b820");
      // drizzle
      px(6,12,4,2,"#a06808");px(7,13,2,1,"#804e00");
      break;
    }
    case"matcha":{
      px(4,4,8,8,P.mat);px(5,5,6,6,"#4e9842");
      px(4,4,8,1,"#6ab85e");px(4,11,8,1,"#3a7832");
      px(5,3,6,2,P.matL);px(7,2,2,1,"#3a8030");px(6,1,4,1,"#4a9040");
      // powder sparkle
      px(6,6,1,1,"#8fce7e88");px(9,8,1,1,"#8fce7e88");
      break;
    }
    case"strawberry":{
      px(5,3,6,8,P.str);px(6,4,4,6,"#d03050");
      px(5,3,6,1,"#f05070");px(5,10,6,1,"#b02840");
      // leaf
      px(6,2,4,1,"#60c040");px(7,1,2,1,"#50a030");px(8,0,1,1,"#409028");
      // seeds
      px(6,5,1,1,"#ffe066");px(8,7,1,1,"#ffe066");px(7,9,1,1,"#ffe066");
      break;
    }
    case"tea":{
      const steam=Math.sin(f*.03);
      const bob=Math.sin(f*.022)*1.2;
      px(4,5,8,7,"#c08040");px(5,6,6,5,P.tea);
      px(4,5,8,1,"#d09050");px(4,11,8,1,"#8a5828");
      px(4,5,1,7,"#b87840");px(11,5,1,7,"#9a6430");
      px(5,4,6,1,"#a06828");
      // teabag
      px(10.5,2+bob,1.2,5,"#f1e0bc");px(9.2,3.4+bob,1.4,1.2,"#d6b25e");
      px(10.2,6+bob,1.6,1,"#c8a040");
      // steam
      if(steam>0.05){px(7,2,1,2,"#fff5");}
      if(steam>0.35){px(8,1,1,2,"#fff3");px(6,1,1,1,"#fff2");}
      break;
    }
    case"hot_water":{
      const heat=.5+.5*Math.sin(f*.035);
      px(4,5,8,7,"#ff8050");px(5,6,6,5,P.hot);
      px(4,5,8,1,"#ff9060");px(4,11,8,1,"#d05030");
      px(5,4,6,1,"#ff8a50");
      // heat glow
      px(5,12,2,2,heat>.45?"#ff3300":"#ff5a28");px(9,12,2,2,heat>.3?"#ff4410":"#ff6a30");px(7,13,2,2,"#ff7a38");
      // steam
      if(Math.sin(f*.03)>0.2){px(7,2,1,2,"#fff5");px(9,1,1,1,"#fff3");}
      break;
    }
    case"water":{
      const wave=Math.sin(f*.025);
      const bubble=2+((f/18)%6);
      px(4,4,8,9,"#4ab0d0");px(5,5,6,7,"#58bedd");
      px(4,4,8,1,"#70d0f0");px(4,12,8,1,"#3090b0");
      px(5,3,6,1,"#9de7ff");
      // wave
      px(4,5+wave*.7,8,1,"#8be4ff");px(5,6+wave*.5,6,1,"#70d0f088");
      // bubbles
      px(7,12-bubble,1,1,"#dff7ff");
      if(bubble>2.5)px(5,11-(bubble-2),1,1,"#c8f0ff");
      if(bubble>3.5)px(9,13-(bubble-3.5),1,1,"#b9f0ff");
      break;
    }
    case"cups":{
      // stacked cups with depth
      px(3,4,4,8,P.cupW);px(3,4,4,1,"#fff");px(3,11,4,1,"#d4c8b8");
      px(4,3,2,1,P.cupR);
      px(8,6,4,7,P.cupW);px(8,6,4,1,"#fff");px(8,12,4,1,"#d4c8b8");
      px(9,5,2,1,P.cupR);
      px(6,8,5,5,P.cupW);px(6,8,5,1,"#fff");px(6,12,5,1,"#d4c8b8");
      break;
    }
    case"trash":{
      px(4,3,8,10,"#6a6a6a");px(5,4,6,8,"#585858");
      px(4,3,8,1,"#7a7a7a");px(4,12,8,1,"#484848");
      px(3,2,10,1,"#808080");px(3,2,10,1,"#888");
      px(6,1,4,1,"#999");px(7,0,2,1,"#888");
      // lid handle detail
      px(6,2,4,1,"#6a6a6a");
      // stripes
      px(5,6,1,4,"#4a4a4a");px(7,6,1,4,"#4a4a4a");px(9,6,1,4,"#4a4a4a");
      break;
    }
  }
  const label=T<42?(st.short||st.label):st.label;
  const lblH=Math.max(12,T*.26);const lblY=y+T-lblH;
  ctx.fillStyle=isCatCafe?"#2a1712dd":isCentralPerks?"#efe3d1dd":"#120904dd";
  ctx.fillRect(x+1,lblY,T-2,lblH);
  ctx.fillStyle=isCatCafe?"#2a171244":isCentralPerks?"#efe3d144":"#ffffff08";
  ctx.fillRect(x+1,lblY,T-2,1);
  const lblFont=`bold ${Math.max(9,T*.2)}px 'Outfit','Silkscreen',sans-serif`;
  const lblFill=isCatCafe?"#ffe7cb":isCentralPerks?"#2d655d":"#f0d4a8";
  const lblStroke=isCatCafe?"#1a0d08":isCentralPerks?"#0a2420":"#0a0502";
  drawTextOutlined(ctx,label,x+T/2,y+T-Math.max(2,lblH*.15),lblFill,lblStroke,lblFont);
}

function drawSunbooksFloor(ctx,x,y,T,r,c){
  const base=(r+c)%2===0?"#8a5a34":"#7b4e2d";
  const line="#a77850";
  ctx.fillStyle=base;
  ctx.fillRect(x,y,T,T);
  for(let i=0;i<4;i++){
    ctx.fillStyle=i%2===0?"#ffffff08":"#00000010";
    ctx.fillRect(x,y+i*(T/4),T,1);
  }
  if(r>=2&&r<=5&&c>=6&&c<=11){
    ctx.fillStyle="#496752";
    ctx.fillRect(x+1,y+1,T-2,T-2);
    ctx.fillStyle="#d7c7a7";
    ctx.fillRect(x+1,y+1,T-2,2);
    ctx.fillRect(x+1,y+T-3,T-2,2);
    ctx.fillStyle="#5d8269";
    ctx.fillRect(x+3,y+T/2-1,T-6,2);
  }else{
    ctx.fillStyle=line+"22";
    ctx.fillRect(x,y,1,T);
    ctx.fillRect(x+T-1,y,1,T);
  }
}

function drawSunbooksWall(ctx,x,y,T,r,c){
  ctx.fillStyle="#203b31";
  ctx.fillRect(x,y,T,T);
  ctx.fillStyle="#2f5a49";
  ctx.fillRect(x,y,3,T);
  ctx.fillRect(x+T-3,y,3,T);
  ctx.fillStyle="#6a4a2b";
  ctx.fillRect(x,y+T-6,T,6);
  for(let shelf=0;shelf<2;shelf++){
    const sy=y+4+shelf*(T/2.2);
    ctx.fillStyle="#7c5d3b";
    ctx.fillRect(x+3,sy,T-6,2);
    for(let i=0;i<4;i++){
      const bw=2+(i%2);
      const bx=x+4+i*(T/5);
      const bh=5+((r+c+i)%4);
      ctx.fillStyle=["#d8b48c","#84c69b","#f0c36b","#96b8f4","#d2a1ea"][(r+c+i)%5];
      ctx.fillRect(bx,sy-bh,bw,bh);
    }
  }
}

function drawSunbooksCounter(ctx,x,y,T,item,f){
  drawSunbooksFloor(ctx,x,y,T,0,0);
  ctx.fillStyle="#f0e4cf";
  ctx.fillRect(x+4,y+5,T-8,8);
  ctx.fillStyle="#d6c3a5";
  ctx.fillRect(x+6,y+6,T-12,2);
  ctx.fillStyle="#6f4a2a";
  ctx.fillRect(x+7,y+13,3,T-16);
  ctx.fillRect(x+T-10,y+13,3,T-16);
  ctx.fillStyle="#4a2e18";
  ctx.fillRect(x+6,y+T-5,T-12,3);
  if(item){
    drawCup(ctx,x+T/2-8,y+T/2-8,16,item.ingredients||[]);
  }else{
    ctx.fillStyle="#3a774f";
    ctx.fillRect(x+6,y+8,5,3);
    ctx.fillStyle="#f3eadc";
    ctx.fillRect(x+11,y+8,4,3);
    ctx.fillStyle="#c69b6d";
    ctx.fillRect(x+6,y+11,9,1);
    if(Math.sin(f*.03+x*.05)>0.3){
      ctx.fillStyle="#ffffff22";
      ctx.fillRect(x+5,y+5,T-10,2);
    }
  }
}

function drawSunbooksServe(ctx,x,y,T,f){
  const s=T/16;
  ctx.fillStyle="#21473a";
  ctx.fillRect(x,y,T,T);
  ctx.fillStyle="#f0e4cf";
  ctx.fillRect(x,y, T, 4*s);
  ctx.fillStyle="#6b4c2c";
  ctx.fillRect(x,y+T-3*s,T,3*s);
  ctx.fillStyle="#5ab97f";
  ctx.fillRect(x+3*s,y+5*s,10*s,5*s);
  ctx.fillStyle="#f7f4ea";
  ctx.fillRect(x+6*s,y+4*s,4*s,1*s);
  ctx.fillRect(x+6.5*s,y+5*s,1*s,3*s);
  ctx.fillRect(x+8.5*s,y+5*s,1*s,3*s);
  ctx.fillStyle="#d8b45b";
  ctx.fillRect(x+11*s,y+4*s,2*s,2*s);
  ctx.fillRect(x+10*s,y+10*s,4*s,2*s);
  if(f%60<10){
    ctx.fillStyle="#ffd70066";
    ctx.fillRect(x+10*s,y+4*s,1*s,1*s);
  }
}

function drawCafeCat(ctx,x,y,sz,f,{body="#2f2622",chest="#f5e7d0",eye="#1f120d",accent="#f6b08b",pose="sit",alpha=1,flip=false}={}){
  const s=sz/16;
  const bob=Math.sin(f*.05+x*.01)*.7;
  const px=(a,b,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x+a*s,y+(b+bob)*s,w*s,h*s);};
  ctx.save();
  ctx.globalAlpha=alpha;
  if(flip){
    ctx.translate(x*2+sz,0);
    ctx.scale(-1,1);
  }
  if(pose==="sleep"){
    px(3,9,10,4,body);
    px(4,8,5,3,body);
    px(8,8,3,2,chest);
    px(2,10,2,2,body);
    px(12,9,2,1,body);
    px(13,8,1,1,body);
    px(5,8,1,1,accent);
    px(10,8,1,1,accent);
  }else if(pose==="stretch"){
    px(2,9,10,3,body);
    px(10,7,4,4,body);
    px(11,6,1,1,accent);
    px(13,6,1,1,accent);
    px(3,8,2,1,chest);
    px(1,8,2,1,body);
    px(0,7,1,1,body);
    px(11,8,1,1,eye);
  }else if(pose==="walk"){
    const step=Math.sin(f*.45)>0?0:1;
    px(4,8,7,4,body);
    px(9,7,4,4,body);
    px(9,6,1,1,accent);
    px(12,6,1,1,accent);
    px(9,8,1,1,eye);
    px(6,8,2,1,chest);
    px(step?4:5,12,2,2,body);
    px(step?8:7,11,2,3,body);
    px(step?11:10,12,2,2,body);
    px(2,8,2,1,body);
    px(1,7,1,2,body);
    px(0,6,1,1,body);
  }else{
    px(4,8,8,5,body);
    px(5,5,6,4,body);
    px(5,4,2,2,accent);
    px(9,4,2,2,accent);
    px(6,6,1,1,eye);
    px(9,6,1,1,eye);
    px(7,7,2,1,chest);
    px(4,12,2,2,body);
    px(9,12,2,2,body);
    px(2,8,2,1,body);
    px(1,7,1,2,body);
  }
  ctx.restore();
}

function drawCatCafeFloor(ctx,x,y,T,r,c){
  const base=(r+c)%2===0?"#8a6048":"#7b523d";
  ctx.fillStyle=base;
  ctx.fillRect(x,y,T,T);
  for(let i=0;i<3;i++){
    ctx.fillStyle=i%2===0?"#ffffff08":"#00000010";
    ctx.fillRect(x,y+2+i*(T/3),T,1);
  }
  if(r>=2&&r<=5&&c>=5&&c<=12){
    ctx.fillStyle="#7b6b5f";
    ctx.fillRect(x+1,y+1,T-2,T-2);
    ctx.fillStyle="#d7c3ae";
    ctx.fillRect(x+1,y+1,T-2,2);
    ctx.fillRect(x+1,y+T-3,T-2,2);
    if((r+c)%2===0){
      ctx.fillStyle="#f2ddc4";
      ctx.fillRect(x+T*.38,y+T*.3,3,3);
      ctx.fillRect(x+T*.26,y+T*.42,2,2);
      ctx.fillRect(x+T*.5,y+T*.42,2,2);
      ctx.fillRect(x+T*.34,y+T*.52,2,2);
      ctx.fillRect(x+T*.46,y+T*.52,2,2);
    }
  }else{
    ctx.fillStyle="#a97b61";
    ctx.fillRect(x,y,1,T);
    ctx.fillRect(x+T-1,y,1,T);
  }
}

function drawCatCafeWall(ctx,x,y,T,r,c){
  ctx.fillStyle="#6b473c";
  ctx.fillRect(x,y,T,T);
  for(let i=0;i<4;i++){
    ctx.fillStyle=i%2===0?"#7b5648":"#5d3d32";
    ctx.fillRect(x+i*(T/4),y,T/8,T);
  }
  ctx.fillStyle="#8a5d45";
  ctx.fillRect(x,y+T-6,T,6);
  if(c===0||c===COLS-1){
    ctx.fillStyle="#4c3228";
    ctx.fillRect(x+3,y+3,T-6,T-10);
    ctx.fillStyle="#a97b61";
    ctx.fillRect(x+5,y+6,T-10,2);
    ctx.fillRect(x+5,y+T/2,T-10,2);
    for(let i=0;i<3;i++){
      ctx.fillStyle=["#f3cc7b","#8dd0aa","#9fbef0","#d7a3f0"][(r+c+i)%4];
      ctx.fillRect(x+6+i*(T/5),y+T/2-4,2,5+((r+i)%3));
    }
  }else if(r===ROWS-1){
    ctx.fillStyle="#3f2a22";
    ctx.fillRect(x+4,y+4,T-8,T-12);
    ctx.fillStyle="#f0d8ba";
    ctx.fillRect(x+6,y+6,T-12,2);
    ctx.fillRect(x+6,y+T/2,T-12,2);
  }
}

function drawCatCafeCounter(ctx,x,y,T,item,f){
  drawCatCafeFloor(ctx,x,y,T,Math.round(y/T),Math.round(x/T));
  ctx.fillStyle="#3a251e";
  ctx.fillRect(x+5,y+T-6,T-10,3);
  ctx.fillStyle="#f3dfc7";
  ctx.fillRect(x+4,y+5,T-8,6);
  ctx.fillStyle="#dfc29e";
  ctx.fillRect(x+6,y+6,T-12,2);
  ctx.fillStyle="#8a5d45";
  ctx.fillRect(x+T/2-2,y+11,4,T-16);
  ctx.fillStyle="#604135";
  ctx.fillRect(x+T/2-5,y+T-6,10,2);
  if(item){
    drawCup(ctx,x+T/2-8,y+T/2-8,16,item.ingredients||[]);
  }else if((Math.round(x/T)+Math.round(y/T))%2===0){
    ctx.fillStyle="#cf8f7a";
    ctx.fillRect(x+7,y+8,6,3);
    ctx.fillStyle="#f8e5cd";
    ctx.fillRect(x+8,y+9,4,1);
  }else{
    drawCafeCat(ctx,x+T*.24,y+T*.12,T*.48,f+Math.round(x+y),{body:"#d9c7b5",chest:"#fff2e2",pose:"sleep",alpha:.92});
  }
}

function drawCatCafeServe(ctx,x,y,T,f){
  const s=T/16;
  ctx.fillStyle="#5c3a31";
  ctx.fillRect(x,y,T,T);
  ctx.fillStyle="#f2dfc5";
  ctx.fillRect(x,y,T,4*s);
  ctx.fillStyle="#7d5845";
  ctx.fillRect(x,y+T-3*s,T,3*s);
  ctx.fillStyle="#48633f";
  ctx.fillRect(x+3*s,y+5*s,10*s,5*s);
  ctx.fillStyle="#f4d39c";
  ctx.fillRect(x+6*s,y+4*s,4*s,1*s);
  ctx.fillStyle="#fff5e3";
  ctx.fillRect(x+6*s,y+6*s,4*s,2*s);
  ctx.fillRect(x+7*s,y+8*s,2*s,1*s);
  ctx.fillStyle="#5c3a31";
  ctx.fillRect(x+5*s,y+5*s,1*s,1*s);
  ctx.fillRect(x+10*s,y+5*s,1*s,1*s);
  ctx.fillRect(x+7*s,y+9*s,2*s,1*s);
  ctx.fillStyle="#f0b56f";
  ctx.fillRect(x+11*s,y+10*s,2*s,2*s);
  if(f%60<12){
    ctx.fillStyle="#ffdca466";
    ctx.fillRect(x+11*s,y+4*s,2*s,2*s);
  }
}

function drawCatCafeTvConsole(ctx,x,y,sz,f){
  const unit=sz/16;
  const w=sz*2.4;
  const h=sz*1.25;
  const px=(a,b,cw,ch,color)=>{ctx.fillStyle=color;ctx.fillRect(x+a*unit,y+b*unit,cw*unit,ch*unit);};
  ctx.fillStyle="#5f4034";
  ctx.fillRect(x,y+sz*.3,w,h);
  ctx.fillStyle="#7f5a49";
  ctx.fillRect(x,y+sz*.3,w,sz*.14);
  ctx.fillStyle="#3b241c";
  ctx.fillRect(x+sz*.12,y+sz*.52,w-sz*.24,h-sz*.34);
  ctx.fillStyle="#8a6250";
  ctx.fillRect(x+sz*.22,y+sz*.82,sz*.28,sz*.45);
  ctx.fillRect(x+w-sz*.5,y+sz*.82,sz*.28,sz*.45);

  ctx.fillStyle="#3d2a22";
  ctx.fillRect(x+sz*.42,y-sz*.02,sz*1.56,sz*.9);
  ctx.fillStyle="#1b1411";
  ctx.fillRect(x+sz*.52,y+sz*.08,sz*1.36,sz*.7);

  const sx=x+sz*.58,sy=y+sz*.14,sw=sz*1.24,sh=sz*.58;
  const channel=Math.floor((f/42)%4);
  if(channel===0){
    ["#ff595e","#ffca3a","#8ac926","#1982c4","#6a4c93"].forEach((color,idx)=>{
      ctx.fillStyle=color;
      ctx.fillRect(sx+idx*(sw/5),sy,sw/5,sh);
    });
  }else if(channel===1){
    ctx.fillStyle="#9cd7ff";
    ctx.fillRect(sx,sy,sw,sh);
    ctx.fillStyle="#dff4ff";
    ctx.fillRect(sx+sw*.1,sy+sh*.12,sw*.22,sh*.16);
    ctx.fillRect(sx+sw*.55,sy+sh*.18,sw*.18,sh*.12);
    ctx.fillStyle="#4f6b3f";
    ctx.fillRect(sx,sy+sh*.64,sw,sh*.36);
    ctx.fillStyle="#223019";
    ctx.fillRect(sx+sw*.45,sy+sh*.34,sw*.08,sh*.3);
    ctx.fillRect(sx+sw*.4,sy+sh*.45,sw*.2,sh*.08);
  }else if(channel===2){
    ctx.fillStyle="#d8e0ef";
    ctx.fillRect(sx,sy,sw,sh);
    for(let i=0;i<6;i++){
      ctx.fillStyle=i%2===0?"#94a0b5":"#c5cedb";
      ctx.fillRect(sx,sy+i*(sh/6),sw,sh/12);
    }
    ctx.fillStyle="#63708a";
    ctx.fillRect(sx+sw*.18,sy+sh*.2,sw*.18,sh*.18);
    ctx.fillRect(sx+sw*.62,sy+sh*.5,sw*.14,sh*.14);
  }else{
    ctx.fillStyle="#87c2ff";
    ctx.fillRect(sx,sy,sw,sh);
    ctx.fillStyle="#f5e0a7";
    ctx.fillRect(sx+sw*.08,sy+sh*.12,sw*.18,sh*.18);
    ctx.fillStyle="#4f8f5c";
    ctx.fillRect(sx,sy+sh*.62,sw,sh*.38);
    ctx.fillStyle="#ff8f6b";
    ctx.fillRect(sx+sw*.42,sy+sh*.38,sw*.2,sh*.16);
    ctx.fillStyle="#2b2019";
    ctx.fillRect(sx+sw*.45,sy+sh*.26,sw*.06,sh*.12);
  }
  ctx.fillStyle="#ffffff18";
  ctx.fillRect(sx+2,sy+2,sw*.28,2);
  ctx.fillStyle="#f4d39c";
  ctx.fillRect(x+sz*.96,y+sz*.92,sz*.22,sz*.08);
}

function drawCatCafeAmbient(ctx,T,BW,BH,f){
  const walkers=[
    {from:T*1.3,to:T*4.4,y:BH-T*1.55,size:T*.58,body:"#8b6a52",chest:"#efe1cf",accent:"#e7b78d",phase:0},
    {from:T*5.9,to:T*10.2,y:T*1.62,size:T*.56,body:"#c9804d",chest:"#fff0dc",accent:"#f0bb93",phase:24},
    {from:T*12.2,to:T*15.2,y:T*4.5,size:T*.56,body:"#201918",chest:"#f0e5dd",accent:"#d8a28c",phase:49},
  ];

  walkers.forEach((cat)=>{
    const motion=f*.03+cat.phase;
    const progress=(Math.sin(motion)+1)/2;
    const x=cat.from+(cat.to-cat.from)*progress;
    const facingLeft=Math.cos(motion)<0;
    ctx.fillStyle="#00000028";
    ctx.fillRect(x+cat.size*.16,cat.y+cat.size*.82,cat.size*.66,4);
    drawCafeCat(ctx,x,cat.y,cat.size,f+cat.phase,{body:cat.body,chest:cat.chest,accent:cat.accent,pose:"walk",flip:facingLeft,alpha:.98});
  });

  const consoleX=BW/2-T*1.18;
  const consoleY=BH-T*2.42;
  ctx.fillStyle="#00000024";
  ctx.fillRect(consoleX+T*.22,consoleY+T*1.28,T*2.1,4);
  drawCatCafeTvConsole(ctx,consoleX,consoleY,T*.96,f);
  drawCafeCat(ctx,consoleX+T*.9,consoleY-T*.22,T*.72,f+90,{body:"#e5d2c1",chest:"#fff5e8",accent:"#efbe98",pose:"sit",alpha:.96});
}

function drawCentralPerksFloor(ctx,x,y,T,r,c){
  const base=(r+c)%2===0?"#a06e4f":"#946446";
  ctx.fillStyle=base;
  ctx.fillRect(x,y,T,T);
  ctx.fillStyle="#c39167";
  ctx.fillRect(x,y,1,T);
  ctx.fillRect(x+T-1,y,1,T);
  if(r>=2&&r<=4&&c>=5&&c<=12){
    ctx.fillStyle="#6b4f70";
    ctx.fillRect(x+1,y+1,T-2,T-2);
    ctx.fillStyle="#d7a464";
    ctx.fillRect(x+1,y+1,T-2,2);
    ctx.fillRect(x+1,y+T-3,T-2,2);
    if((r+c)%2===0){
      ctx.fillStyle="#8f7092";
      ctx.fillRect(x+4,y+4,T-8,2);
      ctx.fillRect(x+4,y+T-6,T-8,2);
    }
  }else{
    for(let i=1;i<4;i++){
      ctx.fillStyle=i%2===0?"#ffffff08":"#0000000c";
      ctx.fillRect(x,y+i*(T/4),T,1);
    }
  }
}

function drawCentralPerksWall(ctx,x,y,T,r,c,f){
  ctx.fillStyle="#d4c6b2";
  ctx.fillRect(x,y,T,T);
  ctx.fillStyle="#e9dfd0";
  ctx.fillRect(x,y, T, 3);
  ctx.fillStyle="#2d655d";
  ctx.fillRect(x,y+T-7,T,7);
  if(r===0){
    ctx.fillStyle="#2d655d";
    ctx.fillRect(x+1,y+1,T-2,2);
    if(c>0&&c<COLS-1){
      ctx.fillStyle="#f0e5d8";
      ctx.fillRect(x+3,y+4,T-6,T-8);
      drawCentralPerksWindowScene(ctx,x+4,y+5,T-8,T-10,f,c);
      ctx.fillStyle="#355b58";
      ctx.fillRect(x+T/2-1,y+5,2,T-10);
      ctx.fillRect(x+4,y+T/2,T-8,2);
    }
  }else{
    ctx.fillStyle=(c%3===0)?"#b48774":"#c7baa7";
    ctx.fillRect(x+2,y+2,2,T-9);
  }
}

function drawCentralPerksCounter(ctx,x,y,T,item,f){
  drawCentralPerksFloor(ctx,x,y,T,Math.round(y/T),Math.round(x/T));
  ctx.fillStyle="#36251d";
  ctx.fillRect(x+T/2-2,y+11,4,T-16);
  ctx.fillStyle="#d2c2ad";
  ctx.fillRect(x+4,y+5,T-8,5);
  ctx.fillStyle="#4a3328";
  ctx.fillRect(x+5,y+10,T-10,2);
  ctx.fillStyle="#835d4b";
  ctx.fillRect(x+T/2-6,y+T-6,12,2);
  if(item){
    drawCup(ctx,x+T/2-8,y+T/2-8,16,item.ingredients||[]);
  }else if((Math.round(x/T)+Math.round(y/T))%2===0){
    ctx.fillStyle="#d9784f";
    ctx.fillRect(x+7,y+8,5,3);
    ctx.fillStyle="#f7e6cd";
    ctx.fillRect(x+8,y+9,3,1);
  }else{
    ctx.fillStyle="#2d655d";
    ctx.fillRect(x+7,y+7,4,4);
    ctx.fillStyle="#f3d799";
    ctx.fillRect(x+8,y+8,2,2);
    if(Math.sin(f*.03+x*.04)>0.3){
      ctx.fillStyle="#ffffff22";
      ctx.fillRect(x+5,y+5,T-10,2);
    }
  }
}

function drawCentralPerksServe(ctx,x,y,T,f){
  const s=T/16;
  ctx.fillStyle="#2d655d";
  ctx.fillRect(x,y,T,T);
  ctx.fillStyle="#eadcc7";
  ctx.fillRect(x,y,T,4*s);
  ctx.fillStyle="#744b3f";
  ctx.fillRect(x,y+T-3*s,T,3*s);
  ctx.fillStyle="#d9784f";
  ctx.fillRect(x+3*s,y+5*s,10*s,5*s);
  ctx.fillStyle="#fff1dc";
  ctx.fillRect(x+6*s,y+4*s,4*s,1*s);
  ctx.fillRect(x+7*s,y+6*s,2*s,2*s);
  ctx.fillStyle="#5d2d23";
  ctx.fillRect(x+5*s,y+5*s,1*s,1*s);
  ctx.fillRect(x+10*s,y+5*s,1*s,1*s);
  ctx.fillRect(x+7*s,y+8*s,2*s,1*s);
  ctx.fillStyle="#f0c989";
  ctx.fillRect(x+11*s,y+10*s,2*s,2*s);
  if(f%60<10){
    ctx.fillStyle="#ffe2a066";
    ctx.fillRect(x+11*s,y+4*s,2*s,2*s);
  }
}

// ─── HALLOWEEN THEME ─────────────────────────────────
function drawHalloweenFloor(ctx,x,y,T,r,c){
  ctx.fillStyle=(r+c)%2===0?"#3a2030":"#321828";
  ctx.fillRect(x,y,T,T);
  ctx.fillStyle="#ffffff06";ctx.fillRect(x,y,T,1);ctx.fillRect(x,y,1,T);
  ctx.fillStyle="#00000012";ctx.fillRect(x,y+T-1,T,1);
  // floor cracks
  if((r*7+c*13)%11===0){ctx.fillStyle="#1a0a1822";ctx.fillRect(x+T*.3,y+T*.4,T*.4,1);}
}
function drawHalloweenWall(ctx,x,y,T,r,c,f){
  ctx.fillStyle="#1a0a18";ctx.fillRect(x,y,T,T);
  ctx.fillStyle="#2a1428";ctx.fillRect(x+1,y+1,T-2,T-2);
  // brick pattern
  const bh=T/4;
  for(let by=0;by<4;by++){
    const off=by%2===0?0:T/2;
    ctx.fillStyle="#3a1c3020";ctx.fillRect(x,y+by*bh,T,1);
    ctx.fillRect(x+off,y+by*bh,1,bh);ctx.fillRect(x+off+T/2,y+by*bh,1,bh);
  }
  // cobweb in corners
  if(r===0&&(c===0||c===COLS-1)){
    const cx=c===0?x:x+T,dir=c===0?1:-1;
    ctx.strokeStyle="#ffffff18";ctx.lineWidth=.7;
    for(let i=0;i<4;i++){
      ctx.beginPath();ctx.moveTo(cx,y);
      ctx.lineTo(cx+dir*T*(.3+i*.18),y+T*(.3+i*.15));ctx.stroke();
    }
  }
  // jack-o-lantern on bottom walls
  if(r===ROWS-1&&(c===3||c===14)){
    const s=T/16;const ox=x,oy=y;
    ctx.fillStyle="#ff8c00";ctx.fillRect(ox+4*s,oy+4*s,8*s,7*s);
    ctx.fillStyle="#ff6600";ctx.fillRect(ox+5*s,oy+5*s,6*s,5*s);
    ctx.fillStyle="#2a1008";ctx.fillRect(ox+3*s,oy+3*s,2*s,1*s);
    // face
    ctx.fillStyle="#ffe066";
    ctx.fillRect(ox+5*s,oy+6*s,2*s,2*s);ctx.fillRect(ox+9*s,oy+6*s,2*s,2*s);
    ctx.fillRect(ox+6*s,oy+9*s,4*s,1*s);
    ctx.fillRect(ox+7*s,oy+10*s,2*s,1*s);
    if(f%80<12){ctx.fillStyle="#ffe06644";ctx.fillRect(ox+3*s,oy+2*s,10*s,2*s);}
  }
}
function drawHalloweenCounter(ctx,x,y,T,it,f){
  drawHalloweenFloor(ctx,x,y,T,3,5);
  ctx.fillStyle="#3a1828";ctx.fillRect(x+3,y+3,T-6,T-6);
  ctx.fillStyle="#4a2838";ctx.fillRect(x+3,y+3,T-6,4);
  ctx.fillStyle="#2a1020";ctx.fillRect(x+3,y+T-8,T-6,4);
  if(it)drawCup(ctx,x+T/2-8,y+T/2-10,16,it.ingredients||[]);
  else{
    // candle
    ctx.fillStyle="#f5e6d3";ctx.fillRect(x+T/2-2,y+T/2-4,4,8);
    ctx.fillStyle="#ff6600";ctx.fillRect(x+T/2-1,y+T/2-6,2,3);
    if(f%40<8){ctx.fillStyle="#ffe06644";ctx.fillRect(x+T/2-4,y+T/2-8,8,4);}
  }
}
function drawHalloweenServe(ctx,x,y,T,f){
  const s=T/16;
  ctx.fillStyle="#2a1030";ctx.fillRect(x,y,T,T);
  ctx.fillStyle="#4a2040";ctx.fillRect(x,y,T,4*s);
  ctx.fillStyle="#1a0820";ctx.fillRect(x,y+T-2*s,T,2*s);
  ctx.fillStyle="#9b30ff";ctx.fillRect(x+3*s,y+5*s,10*s,4*s);
  ctx.fillStyle="#ff8c00";ctx.fillRect(x+5*s,y+5*s,6*s,4*s);
  ctx.fillRect(x+7*s,y+3*s,2*s,2*s);ctx.fillRect(x+4*s,y+9*s,8*s,2*s);
  if(f%60<8){ctx.fillStyle="#ff8c0066";ctx.fillRect(x+3*s,y+2*s,s,s);ctx.fillRect(x+12*s,y+2*s,s,s);}
}
function drawHalloweenAmbient(ctx,T,BW,BH,f){
  // floating bats
  for(let i=0;i<3;i++){
    const bx=((f*.4+i*220)%(BW+40))-20;
    const by=T*.3+Math.sin(f*.03+i*2)*T*.4;
    const wing=Math.sin(f*.15+i)*4;
    ctx.fillStyle="#1a0a1888";
    ctx.fillRect(bx-6-wing,by,6+wing,3);ctx.fillRect(bx+3,by,6+wing,3);
    ctx.fillRect(bx-1,by-1,5,5);
    ctx.fillStyle="#ff660044";ctx.fillRect(bx,by,1,1);ctx.fillRect(bx+2,by,1,1);
  }
  // floating ghost
  const gx=BW*.6+Math.sin(f*.015)*T*2;
  const gy=T*1.2+Math.sin(f*.025)*T*.5;
  ctx.globalAlpha=.15+Math.sin(f*.02)*.08;
  ctx.fillStyle="#fff";
  ctx.beginPath();ctx.arc(gx,gy,T*.35,Math.PI,0);ctx.fill();
  ctx.fillRect(gx-T*.35,gy,T*.7,T*.4);
  for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(gx-T*.23+i*T*.23,gy+T*.4,T*.12,0,Math.PI);ctx.fill();}
  ctx.fillStyle="#333";
  ctx.fillRect(gx-T*.12,gy-T*.08,T*.06,T*.06);ctx.fillRect(gx+T*.06,gy-T*.08,T*.06,T*.06);
  ctx.globalAlpha=1;
}

// ─── WINTER THEME ───────────────────────────────────
function drawWinterFloor(ctx,x,y,T,r,c){
  ctx.fillStyle=(r+c)%2===0?"#5a4a3a":"#4e4030";
  ctx.fillRect(x,y,T,T);
  ctx.fillStyle="#ffffff08";ctx.fillRect(x,y,T,1);ctx.fillRect(x,y,1,T);
  // wood grain
  if(c%3===0){ctx.fillStyle="#00000008";ctx.fillRect(x+T*.4,y,1,T);}
  // snow flecks near walls
  if(r<=1||r>=ROWS-2){
    if((r*11+c*7)%5===0){ctx.fillStyle="#ffffff12";ctx.fillRect(x+T*.3,y+T*.2,2,2);}
  }
}
function drawWinterWall(ctx,x,y,T,r,c,f){
  ctx.fillStyle="#2a3848";ctx.fillRect(x,y,T,T);
  ctx.fillStyle="#1e3050";ctx.fillRect(x+1,y+1,T-2,T-2);
  // log cabin pattern
  const lh=T/3;
  for(let ly=0;ly<3;ly++){
    ctx.fillStyle=ly%2===0?"#5a4a3a":"#4e4030";
    ctx.fillRect(x+2,y+ly*lh+1,T-4,lh-1);
    ctx.fillStyle="#3a302422";ctx.fillRect(x+2,y+ly*lh,T-4,1);
  }
  // window with snow scene (side walls)
  if((c===0||c===COLS-1)&&r>=2&&r<=5){
    ctx.fillStyle="#1a2a40";ctx.fillRect(x+3,y+2,T-6,T-4);
    ctx.fillStyle="#2a4060";ctx.fillRect(x+4,y+3,T-8,T-6);
    // snow ground
    ctx.fillStyle="#d0e4f0";ctx.fillRect(x+4,y+T*.6,T-8,T*.3);
    // falling snow
    for(let i=0;i<3;i++){
      const sx=x+5+((f*.3+i*12+c*7)%Math.max(1,T-10));
      const sy=y+3+((f*.5+i*18+r*11)%(T-8));
      ctx.fillStyle="#ffffff44";ctx.fillRect(sx,sy,1.5,1.5);
    }
    // window frame
    ctx.strokeStyle="#5a4a3a";ctx.lineWidth=1.5;
    ctx.strokeRect(x+3.5,y+2.5,T-7,T-5);
    ctx.fillStyle="#5a4a3a";ctx.fillRect(x+T/2-1,y+2,2,T-4);ctx.fillRect(x+3,y+T/2-1,T-6,2);
  }
  // wreath on bottom walls
  if(r===ROWS-1&&(c===4||c===13)){
    const cx=x+T/2,cy=y+T/2;const wr=T*.3;
    ctx.strokeStyle="#2d8040";ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(cx,cy,wr,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle="#cc2222";ctx.beginPath();ctx.arc(cx,cy-wr,3,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#cc2222";ctx.beginPath();ctx.arc(cx-wr*.7,cy+wr*.7,2.5,0,Math.PI*2);ctx.fill();
  }
  // string lights along top
  if(r===0){
    const bulbColors=["#ff4444","#44ff44","#4488ff","#ffcc00","#ff44ff"];
    ctx.fillStyle="#22222244";ctx.fillRect(x,y+T-4,T,2);
    const bc=bulbColors[(c*3)%bulbColors.length];
    const bright=Math.sin(f*.04+c*.8)>.2;
    ctx.fillStyle=bright?bc:bc+"44";
    ctx.beginPath();ctx.arc(x+T/2,y+T-2,2.5,0,Math.PI*2);ctx.fill();
    if(bright){ctx.fillStyle=bc+"22";ctx.beginPath();ctx.arc(x+T/2,y+T-2,5,0,Math.PI*2);ctx.fill();}
  }
}
function drawWinterCounter(ctx,x,y,T,it,f){
  drawWinterFloor(ctx,x,y,T,3,5);
  ctx.fillStyle="#5a4a3a";ctx.fillRect(x+3,y+3,T-6,T-6);
  ctx.fillStyle="#6a5a48";ctx.fillRect(x+3,y+3,T-6,4);
  ctx.fillStyle="#4a3a28";ctx.fillRect(x+3,y+T-8,T-6,4);
  if(it)drawCup(ctx,x+T/2-8,y+T/2-10,16,it.ingredients||[]);
  else{
    // gift box
    ctx.fillStyle="#cc2222";ctx.fillRect(x+T/2-5,y+T/2-3,10,8);
    ctx.fillStyle="#44aa44";ctx.fillRect(x+T/2-1,y+T/2-3,2,8);
    ctx.fillRect(x+T/2-5,y+T/2,10,2);
    ctx.fillStyle="#ffcc00";ctx.fillRect(x+T/2-2,y+T/2-5,4,3);
  }
}
function drawWinterServe(ctx,x,y,T,f){
  const s=T/16;
  ctx.fillStyle="#1e3050";ctx.fillRect(x,y,T,T);
  ctx.fillStyle="#6a5a48";ctx.fillRect(x,y,T,4*s);
  ctx.fillStyle="#3a302a";ctx.fillRect(x,y+T-2*s,T,2*s);
  ctx.fillStyle="#cc2222";ctx.fillRect(x+3*s,y+5*s,10*s,4*s);
  ctx.fillStyle="#ffcc00";ctx.fillRect(x+5*s,y+5*s,6*s,4*s);
  ctx.fillRect(x+7*s,y+3*s,2*s,2*s);ctx.fillRect(x+4*s,y+9*s,8*s,2*s);
  if(f%60<8){ctx.fillStyle="#ffcc0044";ctx.fillRect(x+3*s,y+2*s,s,s);ctx.fillRect(x+12*s,y+2*s,s,s);}
}
function drawWinterAmbient(ctx,T,BW,BH,f){
  // falling snow particles
  ctx.fillStyle="#ffffff";
  for(let i=0;i<20;i++){
    const sx=((f*.3+i*97)%(BW+10))-5;
    const sy=((f*.4+i*71+Math.sin(f*.01+i)*20)%(BH+10))-5;
    const sz=1+((i*3)%3)*.5;
    ctx.globalAlpha=.12+((i*7)%5)*.04;
    ctx.fillRect(sx,sy,sz,sz);
  }
  ctx.globalAlpha=1;
  // Christmas tree on right side
  const tx=BW-T*1.8,ty=T*.8;
  const ts=T*.08;
  // trunk
  ctx.fillStyle="#5a3a20";ctx.fillRect(tx+4*ts,ty+12*ts,3*ts,4*ts);
  // tree layers
  ctx.fillStyle="#1a6030";
  ctx.beginPath();ctx.moveTo(tx+5.5*ts,ty);ctx.lineTo(tx,ty+6*ts);ctx.lineTo(tx+11*ts,ty+6*ts);ctx.fill();
  ctx.beginPath();ctx.moveTo(tx+5.5*ts,ty+3*ts);ctx.lineTo(tx-ts,ty+9*ts);ctx.lineTo(tx+12*ts,ty+9*ts);ctx.fill();
  ctx.beginPath();ctx.moveTo(tx+5.5*ts,ty+6*ts);ctx.lineTo(tx-2*ts,ty+12*ts);ctx.lineTo(tx+13*ts,ty+12*ts);ctx.fill();
  // star
  ctx.fillStyle="#ffcc00";ctx.fillRect(tx+4.5*ts,ty-2*ts,2*ts,2*ts);
  // ornaments
  const oc=["#ff4444","#4488ff","#ffcc00","#ff44ff"];
  for(let i=0;i<6;i++){
    const ox=tx+1*ts+((i*2.5)%10)*ts;
    const oy=ty+3*ts+((i*3)%8)*ts;
    ctx.fillStyle=oc[i%oc.length];
    ctx.beginPath();ctx.arc(ox,oy,ts*.8,0,Math.PI*2);ctx.fill();
  }
}

// ─── EID THEME ──────────────────────────────────────
function drawEidFloor(ctx,x,y,T,r,c){
  // geometric tile pattern
  const isLight=(r+c)%2===0;
  ctx.fillStyle=isLight?"#c4956a":"#b08558";
  ctx.fillRect(x,y,T,T);
  // geometric diamond inlay
  ctx.fillStyle=isLight?"#d4af3720":"#40bfa018";
  ctx.beginPath();
  ctx.moveTo(x+T/2,y+2);ctx.lineTo(x+T-2,y+T/2);
  ctx.lineTo(x+T/2,y+T-2);ctx.lineTo(x+2,y+T/2);
  ctx.closePath();ctx.fill();
  ctx.fillStyle="#ffffff08";ctx.fillRect(x,y,T,1);ctx.fillRect(x,y,1,T);
}
function drawEidWall(ctx,x,y,T,r,c,f){
  ctx.fillStyle="#0a1830";ctx.fillRect(x,y,T,T);
  ctx.fillStyle="#142848";ctx.fillRect(x+1,y+1,T-2,T-2);
  // geometric Islamic pattern
  const s=T/8;
  ctx.fillStyle="#d4af3718";
  for(let i=0;i<4;i++)for(let j=0;j<4;j++){
    if((i+j)%2===0){ctx.fillRect(x+i*s*2+1,y+j*s*2+1,s*2-1,s*2-1);}
  }
  ctx.strokeStyle="#d4af3722";ctx.lineWidth=.5;
  ctx.beginPath();
  ctx.moveTo(x+T/2,y);ctx.lineTo(x+T,y+T/2);ctx.lineTo(x+T/2,y+T);ctx.lineTo(x,y+T/2);ctx.closePath();
  ctx.stroke();
  // arch on top wall
  if(r===0&&c>=3&&c<=14&&c%3===0){
    ctx.fillStyle="#d4af3730";
    ctx.beginPath();ctx.arc(x+T/2,y+T,T*.4,Math.PI,0);ctx.fill();
    ctx.fillStyle="#40bfa020";
    ctx.beginPath();ctx.arc(x+T/2,y+T,T*.25,Math.PI,0);ctx.fill();
  }
  // fanoos lantern on side walls
  if((c===0||c===COLS-1)&&(r===2||r===4)){
    const lx=c===0?x+T*.3:x+T*.5,ly=y+T*.15;
    const ls=T*.06;
    // chain
    ctx.fillStyle="#d4af3744";ctx.fillRect(lx+2*ls,ly-2*ls,ls,3*ls);
    // lantern body
    ctx.fillStyle="#d4af37";ctx.fillRect(lx,ly+ls,5*ls,7*ls);
    ctx.fillStyle="#ff880088";ctx.fillRect(lx+ls,ly+2*ls,3*ls,5*ls);
    // top cap
    ctx.fillStyle="#d4af37";ctx.fillRect(lx-ls,ly,7*ls,2*ls);
    ctx.fillRect(lx+ls,ly-ls,3*ls,ls);
    // bottom
    ctx.fillRect(lx,ly+8*ls,5*ls,ls);ctx.fillRect(lx+ls,ly+9*ls,3*ls,ls);
    // glow
    if(Math.sin(f*.03+r)>.1){
      ctx.fillStyle="#ff880018";
      ctx.beginPath();ctx.arc(lx+2.5*ls,ly+5*ls,T*.25,0,Math.PI*2);ctx.fill();
    }
  }
}
function drawEidCounter(ctx,x,y,T,it,f){
  drawEidFloor(ctx,x,y,T,3,5);
  ctx.fillStyle="#5a3828";ctx.fillRect(x+3,y+3,T-6,T-6);
  ctx.fillStyle="#6a4838";ctx.fillRect(x+3,y+3,T-6,4);
  ctx.fillStyle="#4a2818";ctx.fillRect(x+3,y+T-8,T-6,4);
  // gold trim
  ctx.fillStyle="#d4af3730";ctx.fillRect(x+3,y+3,T-6,1);ctx.fillRect(x+3,y+T-5,T-6,1);
  if(it)drawCup(ctx,x+T/2-8,y+T/2-10,16,it.ingredients||[]);
  else{
    // dates plate
    ctx.fillStyle="#8a6a4a";ctx.fillRect(x+T/2-6,y+T/2-1,12,5);
    ctx.fillStyle="#5a3018";ctx.fillRect(x+T/2-4,y+T/2,3,3);
    ctx.fillStyle="#6a3820";ctx.fillRect(x+T/2+1,y+T/2,3,3);
  }
}
function drawEidServe(ctx,x,y,T,f){
  const s=T/16;
  ctx.fillStyle="#1a3050";ctx.fillRect(x,y,T,T);
  ctx.fillStyle="#6a4838";ctx.fillRect(x,y,T,4*s);
  ctx.fillStyle="#3a2818";ctx.fillRect(x,y+T-2*s,T,2*s);
  // gold trim
  ctx.fillStyle="#d4af3740";ctx.fillRect(x,y+4*s-1,T,1);
  ctx.fillStyle="#d4af37";ctx.fillRect(x+5*s,y+5*s,6*s,4*s);
  ctx.fillRect(x+7*s,y+3*s,2*s,2*s);ctx.fillRect(x+4*s,y+9*s,8*s,2*s);
  if(f%60<10){ctx.fillStyle="#d4af3766";ctx.fillRect(x+3*s,y+2*s,s,s);ctx.fillRect(x+12*s,y+2*s,s,s);}
}
function drawEidAmbient(ctx,T,BW,BH,f){
  // crescent moon and stars in the sky area
  const mx=BW*.75,my=T*.4;
  ctx.globalAlpha=.18;
  ctx.fillStyle="#fff8d0";
  ctx.beginPath();ctx.arc(mx,my,T*.3,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#0a1830";
  ctx.beginPath();ctx.arc(mx+T*.12,my-T*.05,T*.25,0,Math.PI*2);ctx.fill();
  // stars
  ctx.fillStyle="#fff8d0";
  const starPos=[[BW*.2,T*.25],[BW*.35,T*.35],[BW*.55,T*.2],[BW*.85,T*.3],[BW*.15,T*.45],[BW*.65,T*.4]];
  for(const[sx,sy]of starPos){
    const twinkle=Math.sin(f*.05+sx*.1)>.2;
    ctx.globalAlpha=twinkle?.15:.06;
    ctx.fillRect(sx-1,sy,3,1);ctx.fillRect(sx,sy-1,1,3);
  }
  ctx.globalAlpha=1;
}

function drawTextOutlined(ctx,text,x,y,fill,outline,font){
  if(font)ctx.font=font;
  ctx.textAlign="center";
  ctx.strokeStyle=outline||"#120904";
  ctx.lineWidth=3;ctx.lineJoin="round";
  ctx.strokeText(text,x,y);
  ctx.fillStyle=fill||"#f5e6d3";
  ctx.fillText(text,x,y);
}

function drawTutorialHighlight(ctx,x,y,T,f,color,number){
  const pulse=(Math.sin(f*.08)+1)/2;
  const cx=x+T/2;
  ctx.save();
  // pulsing glow border
  ctx.globalAlpha=.22+pulse*.38;
  ctx.shadowColor=color;ctx.shadowBlur=10+pulse*10;
  ctx.strokeStyle=color;ctx.lineWidth=2.5;
  ctx.beginPath();
  if(ctx.roundRect)ctx.roundRect(x+1,y+1,T-2,T-2,4);
  else{ctx.rect(x+1,y+1,T-2,T-2);}
  ctx.stroke();
  ctx.shadowBlur=0;
  // corner sparkles
  ctx.globalAlpha=.4+pulse*.5;
  ctx.fillStyle="#fff";
  const sp=3;
  ctx.fillRect(x+sp,y+sp,2,2);ctx.fillRect(x+T-sp-2,y+sp,2,2);
  ctx.fillRect(x+sp,y+T-sp-2,2,2);ctx.fillRect(x+T-sp-2,y+T-sp-2,2,2);
  // bouncing arrow above
  const arrowY=y-10-Math.sin(f*.12)*5;
  ctx.globalAlpha=.7+pulse*.3;
  ctx.fillStyle=color;
  ctx.beginPath();
  ctx.moveTo(cx,arrowY+9);
  ctx.lineTo(cx-6,arrowY+1);
  ctx.lineTo(cx+6,arrowY+1);
  ctx.closePath();
  ctx.fill();
  // arrow stem
  ctx.fillRect(cx-1.5,arrowY-4,3,5);
  // step number badge
  if(number!==undefined){
    ctx.globalAlpha=.85;
    ctx.fillStyle=color;
    ctx.beginPath();ctx.arc(x+T-3,y+3,7,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#120904";
    ctx.font="bold 8px 'Silkscreen',monospace";
    ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText(String(number),x+T-3,y+3.5);
  }
  ctx.restore();
}

function drawServe(ctx,x,y,T,f){
  const s=T/16;ctx.fillStyle=P.counter;ctx.fillRect(x,y,T,T);
  ctx.fillStyle=P.counterTop;ctx.fillRect(x,y,T,4*s);
  ctx.fillStyle=P.counterEdge;ctx.fillRect(x,y+T-2*s,T,2*s);
  ctx.fillStyle=P.gold;ctx.fillRect(x+5*s,y+5*s,6*s,4*s);ctx.fillRect(x+7*s,y+3*s,2*s,2*s);ctx.fillRect(x+4*s,y+9*s,8*s,2*s);
  if(f%60<5){ctx.fillStyle="#ffd70066";ctx.fillRect(x+3*s,y+2*s,s,s);ctx.fillRect(x+12*s,y+2*s,s,s);}
}

function shortDrinkLabel(name){
  const cleaned=(name||"").replace("Cafe ","").replace("Iced ","I. ").replace("Double ","D. ");
  const words=cleaned.split(" ").filter(Boolean);
  if(words.length===1)return words[0].slice(0,4).toUpperCase();
  return words.map((word)=>word[0]).join("").slice(0,4).toUpperCase();
}

function drawCustomer(ctx,x,y,sz,cust,f,{alpha=1,showCup=false}={}){
  const s=sz/16;
  const bob=Math.sin(f*.05+x*.01)*1.5;
  const px=(a,b,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x+a*s,y+b*s+bob,w*s,h*s);};
  ctx.save();
  ctx.globalAlpha=alpha;
  px(4,8,8,6,cust.shirt||"#8a6a4a");
  px(4,12,8,1,cust.accent||"#d7ccc8");
  px(3,9,2,3,cust.skin||P.skin);px(11,9,2,3,cust.skin||P.skin);
  px(4,3,8,6,cust.skin||P.skin);
  px(3,1,10,3,cust.hair||"#332014");px(4,0,8,2,cust.hair||"#332014");
  px(4,2,1,5,cust.hair||"#332014");px(11,2,1,5,cust.hair||"#332014");
  if(f%120<8){px(5,5,2,1,cust.hair||"#332014");px(9,5,2,1,cust.hair||"#332014");}
  else{px(5,5,2,1,P.black);px(9,5,2,1,P.black);px(6,5,1,1,P.white);px(10,5,1,1,P.white);}
  px(6,7,4,1,"#8d5a3b");
  px(5,13,6,2,cust.shirt||"#8a6a4a");
  if(showCup){
    ctx.fillStyle=P.cupW;
    ctx.fillRect(x+11*s,y+10*s+bob,3*s,4*s);
    ctx.fillStyle=P.cupR;
    ctx.fillRect(x+11.5*s,y+9.5*s+bob,2*s,.8*s);
  }
  ctx.restore();
}

function drawOrderBubble(ctx,x,y,T,order){
  const w=Math.max(T*.9,36),h=Math.max(T*.38,18),rx=x-w/2,ry=y-h;
  const label=shortDrinkLabel(order.drink);
  const pct=1-order.elapsed/order.patience;
  ctx.fillStyle="#fff8ee";
  ctx.fillRect(rx,ry,w,h);
  ctx.strokeStyle="#5c3a22";
  ctx.lineWidth=1;
  ctx.strokeRect(rx+.5,ry+.5,w-1,h-1);
  ctx.fillStyle=getRecipeUiColor(order.drink);
  ctx.fillRect(rx+4,ry+4,8,8);
  ctx.fillStyle="#5c3a22";
  ctx.font=`bold ${Math.max(7,T*.14)}px monospace`;
  ctx.textAlign="left";
  ctx.fillText(label,rx+16,ry+11);
  ctx.fillStyle="#24150d";
  ctx.fillRect(rx+4,ry+h-5,w-8,2);
  ctx.fillStyle=pct>.5?P.green:pct>.25?P.orange:P.red;
  ctx.fillRect(rx+4,ry+h-5,(w-8)*Math.max(0,Math.min(1,pct)),2);
}

function drawTapTargetMarker(ctx,T,target,f){
  if(!target||target.life<=0)return;
  const x=target.c*T,y=target.r*T;
  const pct=target.life/target.ml;
  const pulse=(Math.sin(f*.24)+1)/2;
  const inset=3+Math.round((1-pulse)*2);
  ctx.save();
  ctx.globalAlpha=Math.max(.22,pct*.85);
  ctx.fillStyle=target.accent||P.gold;
  if(target.kind==="floor"){
    ctx.beginPath();
    ctx.arc(x+T/2,y+T/2,Math.max(8,T*.16)+pulse*2,0,Math.PI*2);
    ctx.fill();
    ctx.globalAlpha=Math.max(.55,pct);
    ctx.strokeStyle="#fff8d6";
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.arc(x+T/2,y+T/2,Math.max(10,T*.22)+pulse*3,0,Math.PI*2);
    ctx.stroke();
  }else{
    ctx.fillRect(x+inset,y+inset,T-inset*2,T-inset*2);
    ctx.globalAlpha=Math.max(.55,pct);
    ctx.strokeStyle="#fff6d8";
    ctx.lineWidth=2;
    ctx.strokeRect(x+inset-.5,y+inset-.5,T-(inset*2)+1,T-(inset*2)+1);
  }
  ctx.globalAlpha=Math.max(.72,pct);
  ctx.fillStyle="#120904dd";
  ctx.fillRect(x+T*.14,y+T*.08,T*.34,T*.18);
  ctx.fillStyle="#fff2d6";
  ctx.font=`bold ${Math.max(7,T*.14)}px monospace`;
  ctx.textAlign="center";
  ctx.fillText(target.label||"GO",x+T*.31,y+T*.2);
  ctx.restore();
}

function drawCustomerArea(ctx,T,BW,BH,orders,f){
  const mapTheme=getActiveMapDef().theme||{};
  ctx.save();
  if(mapTheme.deco==="centralperks"){
    const areaY=BH-T*.78;
    ctx.fillStyle="#233b39";
    ctx.fillRect(0,areaY+T*.44,BW,T*.34);
    ctx.fillStyle="#d2c3ae";
    ctx.fillRect(0,areaY+T*.4,BW,2);
    ctx.fillStyle="#18302d";
    ctx.fillRect(0,areaY+T*.68,BW,T*.1);
    drawCentralPerksLoungeProps(ctx,T,BW,BH,f);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0,areaY,BW,T*.78);
    ctx.clip();
    drawCustomer(ctx,T*.86,areaY+T*.08,T*.82,AMBIENT_CUSTOMERS[0],f+12,{alpha:.82,showCup:true});
    drawCustomer(ctx,BW-T*1.96,areaY+T*.06,T*.86,AMBIENT_CUSTOMERS[1],f+25,{alpha:.84,showCup:true});
    orders.slice(0,QUEUE_COLS.length).forEach((order,idx)=>{
      const qx=QUEUE_COLS[idx]*T-T*.42;
      const qy=BH-T*.66+(idx%2)*2;
      drawCustomer(ctx,qx,qy,T*.92,order.cust,f+idx*9,{showCup:idx%3===0});
    });
    ctx.restore();

    orders.slice(0,QUEUE_COLS.length).forEach((order,idx)=>{
      const bx=QUEUE_COLS[idx]*T;
      const by=BH-T*.28+(idx%2)*2;
      drawOrderBubble(ctx,bx,by,T,order);
      ctx.fillStyle="#fff1dd";
      ctx.font=`bold ${Math.max(7,T*.13)}px monospace`;
      ctx.textAlign="center";
      ctx.fillText(order.cust.name,bx,BH-6);
    });

    ctx.fillStyle="#f0c989";
    ctx.font=`bold ${Math.max(7,T*.13)}px monospace`;
    ctx.textAlign="left";
    ctx.fillText("COUCH SERVICE",T*.46,BH-T*.7);
    ctx.restore();
    return;
  }
  if(mapTheme.customerSide==="bottom"){
    // Eid and similar bottom-customer maps
    const areaY=BH-T*.78;
    const bgCol=mapTheme.deco==="eid"?"#0a1830cc":"#120904aa";
    ctx.fillStyle=bgCol;
    ctx.fillRect(0,areaY+T*.44,BW,T*.34);
    ctx.fillStyle=mapTheme.deco==="eid"?"#d4af3744":"#d2c3ae";
    ctx.fillRect(0,areaY+T*.4,BW,2);
    ctx.fillStyle=mapTheme.deco==="eid"?"#0a1020":"#18302d";
    ctx.fillRect(0,areaY+T*.68,BW,T*.1);

    ctx.save();
    ctx.beginPath();ctx.rect(0,areaY,BW,T*.78);ctx.clip();
    drawCustomer(ctx,T*.86,areaY+T*.08,T*.82,AMBIENT_CUSTOMERS[0],f+12,{alpha:.82,showCup:true});
    drawCustomer(ctx,BW-T*1.96,areaY+T*.06,T*.86,AMBIENT_CUSTOMERS[1],f+25,{alpha:.84,showCup:true});
    orders.slice(0,QUEUE_COLS.length).forEach((order,idx)=>{
      const qx=QUEUE_COLS[idx]*T-T*.42;
      const qy=BH-T*.66+(idx%2)*2;
      drawCustomer(ctx,qx,qy,T*.92,order.cust,f+idx*9,{showCup:idx%3===0});
    });
    ctx.restore();

    orders.slice(0,QUEUE_COLS.length).forEach((order,idx)=>{
      const bx=QUEUE_COLS[idx]*T;
      const by=BH-T*.28+(idx%2)*2;
      drawOrderBubble(ctx,bx,by,T,order);
      ctx.fillStyle="#fff1dd";
      ctx.font=`bold ${Math.max(7,T*.13)}px monospace`;
      ctx.textAlign="center";
      ctx.fillText(order.cust.name,bx,BH-6);
    });

    ctx.fillStyle=mapTheme.deco==="eid"?"#d4af37":"#f0c989";
    ctx.font=`bold ${Math.max(7,T*.13)}px monospace`;
    ctx.textAlign="left";
    ctx.fillText(mapTheme.deco==="eid"?"EID MUBARAK":"WELCOME",T*.46,BH-T*.7);
    ctx.restore();
    return;
  }
  ctx.fillStyle=mapTheme.deco==="sunbooks"?"#18392dcc":mapTheme.deco==="catcafe"?"#4b312bcc":mapTheme.deco==="halloween"?"#1a0a20cc":mapTheme.deco==="winter"?"#1a2a40cc":"#120904aa";
  ctx.fillRect(0,0,BW,T*.18);
  if(mapTheme.deco==="sunbooks"){
    const paneW=BW/6;
    for(let i=0;i<6;i++){
      const px=i*paneW+2;
      ctx.fillStyle="#f4efdc";
      ctx.fillRect(px,2,paneW-4,T*.54);
      ctx.fillStyle="#9bd2a5";
      ctx.fillRect(px+1,2,2,T*.54);
      ctx.fillRect(px+paneW-7,2,2,T*.54);
      ctx.fillRect(px+paneW/2-1,2,2,T*.54);
      ctx.fillStyle="#d8f0b8";
      ctx.fillRect(px+8,6,paneW-18,T*.18);
      ctx.fillStyle="#6f8d57";
      ctx.fillRect(px+10,8,4,4);
      ctx.fillRect(px+18,10,5,3);
    }
    for(let i=0;i<5;i++){
      const stoolX=T*(2.1+i*2.4);
      ctx.fillStyle="#6b4c2c";
      ctx.fillRect(stoolX,T*.68,T*.22,T*.16);
      ctx.fillRect(stoolX+T*.05,T*.84,T*.04,T*.14);
      ctx.fillRect(stoolX+T*.13,T*.84,T*.04,T*.14);
    }
  }else if(mapTheme.deco==="catcafe"){
    const paneW=BW/5.5;
    for(let i=0;i<5;i++){
      const px=i*paneW+T*.45;
      ctx.fillStyle="#b8d6ef";
      ctx.fillRect(px,2,paneW-T*.2,T*.5);
      ctx.fillStyle="#edf7ff";
      ctx.fillRect(px+2,2,paneW-T*.2-4,T*.48);
      ctx.fillStyle="#7d5845";
      ctx.fillRect(px+paneW*.28,2,3,T*.5);
      ctx.fillRect(px+paneW*.62,2,3,T*.5);
      ctx.fillRect(px, T*.24, paneW-T*.2, 2);
    }
    for(let i=0;i<4;i++){
      const stoolX=T*(2.1+i*2.9);
      ctx.fillStyle="#8a5d45";
      ctx.fillRect(stoolX,T*.66,T*.28,T*.18);
      ctx.fillRect(stoolX+T*.06,T*.84,T*.04,T*.14);
      ctx.fillRect(stoolX+T*.18,T*.84,T*.04,T*.14);
    }
    drawCafeCat(ctx,T*.68,T*.22,T*.52,f+7,{body:"#1f1816",chest:"#f2e4d7",pose:"sit"});
    drawCafeCat(ctx,BW-T*1.55,T*.24,T*.56,f+19,{body:"#d6b188",chest:"#fff3e5",pose:"sleep"});
  }else if(mapTheme.deco==="halloween"){
    // spooky windows with moonlight
    const paneW=BW/5;
    for(let i=0;i<5;i++){
      const px=i*paneW+T*.3;
      ctx.fillStyle="#0a0818";ctx.fillRect(px,2,paneW-T*.3,T*.5);
      ctx.fillStyle="#1a1030";ctx.fillRect(px+2,4,paneW-T*.3-4,T*.46);
      // moon in one window
      if(i===2){ctx.fillStyle="#ffe06644";ctx.beginPath();ctx.arc(px+paneW*.35,T*.18,T*.1,0,Math.PI*2);ctx.fill();}
      // bare tree silhouettes
      ctx.fillStyle="#0a081888";
      ctx.fillRect(px+paneW*.2,T*.25,2,T*.22);
      ctx.fillRect(px+paneW*.15,T*.28,T*.15,1);
      ctx.fillRect(px+paneW*.25,T*.3,T*.1,1);
    }
  }else if(mapTheme.deco==="winter"){
    // frosted windows with snow scene
    const paneW=BW/5;
    for(let i=0;i<5;i++){
      const px=i*paneW+T*.3;
      ctx.fillStyle="#1a2a40";ctx.fillRect(px,2,paneW-T*.3,T*.5);
      ctx.fillStyle="#2a4060";ctx.fillRect(px+2,4,paneW-T*.3-4,T*.46);
      // snow ground
      ctx.fillStyle="#d0e4f0";ctx.fillRect(px+2,T*.32,paneW-T*.3-4,T*.16);
      // falling snow in windows
      for(let j=0;j<3;j++){
        const sx=px+4+((f*.3+j*11+i*17)%Math.max(1,paneW-T*.4));
        const sy=4+((f*.5+j*13+i*19)%(T*.44));
        ctx.fillStyle="#ffffff55";ctx.fillRect(sx,sy,1.5,1.5);
      }
      // window frame
      ctx.strokeStyle="#5a4a3a";ctx.lineWidth=1;
      ctx.strokeRect(px+.5,2.5,paneW-T*.3-1,T*.5-1);
      ctx.fillStyle="#5a4a3a";ctx.fillRect(px+(paneW-T*.3)/2,2,1.5,T*.5);
    }
  }
  for(let i=0;i<8;i++){
    const lx=(i+.5)*(BW/8);
    ctx.fillStyle=i%2?P.gold:"#c4956a";
    ctx.fillRect(lx-2,4,4,4);
    ctx.fillStyle="#ffffff88";
    ctx.fillRect(lx-1,8,2,2);
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(0,0,BW,T*.78);
  ctx.clip();
  AMBIENT_CUSTOMERS.forEach((guest,idx)=>{
    const gx=guest.side==="left"?(T*.45+idx*T*.9):(BW-T*(1.2+idx*.8));
    const gy=T*(idx===2 ? .02 : .06);
    drawCustomer(ctx,gx,gy,T*(guest.scale||.8),guest,f+idx*13,{alpha:.9,showCup:guest.mood==="drink"});
    if(guest.mood==="laptop"){
      ctx.fillStyle="#2d3a4a";
      ctx.fillRect(gx+T*.15,gy+T*.42,T*.22,T*.12);
    }
    if(guest.mood==="phone"){
      ctx.fillStyle="#222";
      ctx.fillRect(gx+T*.42,gy+T*.34,T*.06,T*.14);
    }
  });

  orders.slice(0,QUEUE_COLS.length).forEach((order,idx)=>{
    const qx=QUEUE_COLS[idx]*T-T*.42;
    const qy=T*.05+(idx%2)*2;
    drawCustomer(ctx,qx,qy,T*.92,order.cust,f+idx*9,{showCup:idx%3===0});
  });
  ctx.restore();

  orders.slice(0,QUEUE_COLS.length).forEach((order,idx)=>{
    const bx=QUEUE_COLS[idx]*T;
    const by=T*.1+(idx%2)*2;
    drawOrderBubble(ctx,bx,by,T,order);
    ctx.fillStyle="#f5e6d3";
    ctx.font=`bold ${Math.max(7,T*.13)}px monospace`;
    ctx.textAlign="center";
    ctx.fillText(order.cust.name,bx,T*.76+(idx%2)*2);
  });
  if(mapTheme.deco==="sunbooks"){
    ctx.fillStyle="#7c5d3b";
    ctx.fillRect(T*.3,T*.58,T*2.1,3);
    for(let i=0;i<7;i++){
      ctx.fillStyle=["#d8b48c","#84c69b","#f0c36b","#96b8f4","#d2a1ea"][i%5];
      ctx.fillRect(T*.42+i*T*.22,T*.4,Math.max(3,T*.08),T*.18);
    }
    ctx.fillStyle="#eaf6ec";
    ctx.font=`bold ${Math.max(7,T*.13)}px monospace`;
    ctx.textAlign="left";
    ctx.fillText("BOOK PICKUP",T*.42,T*.37);
  }else if(mapTheme.deco==="catcafe"){
    ctx.fillStyle="#7d5845";
    ctx.fillRect(T*.34,T*.58,T*2.3,3);
    ctx.fillStyle="#f4d39c";
    ctx.font=`bold ${Math.max(7,T*.13)}px monospace`;
    ctx.textAlign="left";
    ctx.fillText("CAT LOUNGE",T*.42,T*.37);
    drawCafeCat(ctx,T*.42,T*.36,T*.38,f+31,{body:"#2a211d",chest:"#f1dfca",pose:"stretch",alpha:.9});
  }else if(mapTheme.deco==="halloween"){
    ctx.fillStyle="#4a1838";ctx.fillRect(T*.34,T*.58,T*2.3,3);
    ctx.fillStyle="#ff8c00";
    ctx.font=`bold ${Math.max(7,T*.13)}px monospace`;
    ctx.textAlign="left";
    ctx.fillText("SPOOKY COUNTER",T*.42,T*.37);
  }else if(mapTheme.deco==="winter"){
    ctx.fillStyle="#5a4a3a";ctx.fillRect(T*.34,T*.58,T*2.3,3);
    ctx.fillStyle="#4fc3f7";
    ctx.font=`bold ${Math.max(7,T*.13)}px monospace`;
    ctx.textAlign="left";
    ctx.fillText("COZY CORNER",T*.42,T*.37);
  }
  ctx.restore();
}

function drawLighting(ctx,T,BW,BH,f,gameState){
  const mapTheme=getActiveMapDef().theme||{};
  ctx.save();

  if(mapTheme.deco==="centralperks"){
    const skyWash=ctx.createLinearGradient(0,0,0,BH*.62);
    skyWash.addColorStop(0,"rgba(176,206,230,0.12)");
    skyWash.addColorStop(.34,"rgba(244,230,198,0.04)");
    skyWash.addColorStop(1,"rgba(255,255,255,0)");
    ctx.fillStyle=skyWash;
    ctx.fillRect(0,0,BW,BH*.62);
  }
  if(mapTheme.deco==="halloween"){
    const spookyWash=ctx.createLinearGradient(0,0,0,BH);
    spookyWash.addColorStop(0,"rgba(100,30,80,0.08)");
    spookyWash.addColorStop(.5,"rgba(60,20,60,0.04)");
    spookyWash.addColorStop(1,"rgba(40,10,40,0.12)");
    ctx.fillStyle=spookyWash;
    ctx.fillRect(0,0,BW,BH);
  }
  if(mapTheme.deco==="winter"){
    const cozyWash=ctx.createLinearGradient(0,0,0,BH*.5);
    cozyWash.addColorStop(0,"rgba(200,220,255,0.06)");
    cozyWash.addColorStop(1,"rgba(255,230,180,0.03)");
    ctx.fillStyle=cozyWash;
    ctx.fillRect(0,0,BW,BH*.5);
  }
  if(mapTheme.deco==="eid"){
    const goldWash=ctx.createLinearGradient(0,0,0,BH*.4);
    goldWash.addColorStop(0,"rgba(212,175,55,0.06)");
    goldWash.addColorStop(1,"rgba(255,255,255,0)");
    ctx.fillStyle=goldWash;
    ctx.fillRect(0,0,BW,BH*.4);
  }

  const pendants=PENDANT_COLS.map((n)=>n*T);
  pendants.forEach((lx,idx)=>{
    const sway=Math.sin(f*.02+idx)*1.5;
    const lampX=lx+sway;
    const lampY=T*.24;
    const glow=ctx.createRadialGradient(lampX,lampY,0,lampX,lampY,T*1.75);
    glow.addColorStop(0,`rgba(${mapTheme.glow||"255,224,138"},0.28)`);
    glow.addColorStop(.35,`rgba(${mapTheme.glow||"255,200,90"},0.12)`);
    glow.addColorStop(1,`rgba(${mapTheme.glow||"255,180,70"},0)`);
    ctx.fillStyle=glow;
    ctx.fillRect(lampX-T*1.75,lampY-T*.8,T*3.5,T*3);

    const cone=ctx.createLinearGradient(lampX,0,lampX,T*1.8);
    cone.addColorStop(0,`rgba(${mapTheme.glow||"255,220,120"},0.12)`);
    cone.addColorStop(.5,`rgba(${mapTheme.glow||"255,210,110"},0.06)`);
    cone.addColorStop(1,`rgba(${mapTheme.glow||"255,190,90"},0)`);
    ctx.fillStyle=cone;
    ctx.beginPath();
    ctx.moveTo(lampX-T*.18,lampY-T*.05);
    ctx.lineTo(lampX+T*.18,lampY-T*.05);
    ctx.lineTo(lampX+T*.9,T*1.85);
    ctx.lineTo(lampX-T*.9,T*1.85);
    ctx.closePath();
    ctx.fill();
  });

  const glowPalette={
    E:{color:"255,196,110",size:1.35,intensity:.2},
    e:{color:"255,196,110",size:1.25,intensity:.18},
    M:{color:"255,244,214",size:1.3,intensity:.16},
    A:{color:"104,206,120",size:1.28,intensity:.18},
    B:{color:"240,96,144",size:1.22,intensity:.16},
    T:{color:"225,176,108",size:1.22,intensity:.15},
    H:{color:"255,164,110",size:1.25,intensity:.18},
    Q:{color:"130,220,255",size:1.28,intensity:.17},
    R:{color:"216,170,74",size:1.2,intensity:.15},
    I:{color:"180,225,255",size:1.15,intensity:.12},
    F:{color:"255,254,240",size:1.1,intensity:.1},
    U:{color:"255,230,200",size:1.1,intensity:.1},
  };
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
    const cell=MAP[r][c];
    const glow=cell.type==="station"?glowPalette[cell.station]:null;
    if(!glow)continue;
    const x=c*T+T/2,y=r*T+T/2;
    const gi=glow.intensity||.14;
    const gg=ctx.createRadialGradient(x,y,0,x,y,T*glow.size);
    gg.addColorStop(0,`rgba(${glow.color},${gi})`);
    gg.addColorStop(.45,`rgba(${glow.color},${gi*.4})`);
    gg.addColorStop(1,`rgba(${glow.color},0)`);
    ctx.fillStyle=gg;
    ctx.fillRect(x-T*glow.size,y-T*glow.size,T*glow.size*2,T*glow.size*2);
  }

  (gameState?.players||[]).forEach((player)=>{
    if(!player.processing?.st)return;
    const x=player.processing.st.c*T+T/2,y=player.processing.st.r*T+T/2;
    const proc=ctx.createRadialGradient(x,y,0,x,y,T*1.2);
    proc.addColorStop(0,"rgba(255,248,210,0.22)");
    proc.addColorStop(.45,"rgba(255,220,140,0.1)");
    proc.addColorStop(1,"rgba(255,180,90,0)");
    ctx.fillStyle=proc;
    ctx.fillRect(x-T*1.2,y-T*1.2,T*2.4,T*2.4);
  });

  const counterGlow=ctx.createLinearGradient(0,T*.82,0,T*1.95);
  const cgInt=mapTheme.deco==="centralperks"?0.05:mapTheme.deco==="halloween"?0.12:0.08;
  const cgInt2=mapTheme.deco==="centralperks"?0.02:mapTheme.deco==="halloween"?0.05:0.03;
  counterGlow.addColorStop(0,`rgba(${mapTheme.glow||"255,212,120"},${cgInt})`);
  counterGlow.addColorStop(.65,`rgba(${mapTheme.glow||"255,190,90"},${cgInt2})`);
  counterGlow.addColorStop(1,`rgba(${mapTheme.glow||"255,160,80"},0)`);
  ctx.fillStyle=counterGlow;
  ctx.fillRect(0,T*.82,BW,T*1.3);

  const vignette=ctx.createRadialGradient(BW/2,BH*.42,T*2.3,BW/2,BH*.55,BW*.72);
  vignette.addColorStop(0,"rgba(0,0,0,0)");
  const vigMid=mapTheme.deco==="centralperks"?"rgba(22,18,14,0.05)":mapTheme.deco==="halloween"?"rgba(20,5,30,0.14)":mapTheme.deco==="eid"?"rgba(10,15,30,0.1)":"rgba(12,6,4,0.08)";
  const vigEdge=mapTheme.deco==="centralperks"?"rgba(12,10,8,0.18)":mapTheme.deco==="halloween"?"rgba(10,2,20,0.35)":mapTheme.deco==="eid"?"rgba(5,10,25,0.22)":"rgba(8,4,2,0.26)";
  vignette.addColorStop(.72,vigMid);
  vignette.addColorStop(1,vigEdge);
  ctx.fillStyle=vignette;
  ctx.fillRect(0,0,BW,BH);

  ctx.restore();
}

function matchRecipe(ings){const s=[...ings].sort().join(",");for(const[n,r]of Object.entries(RECIPES))if([...r.ing].sort().join(",")===s)return n;return null;}

function mkOrder(elapsed,diff){
  const d=DIFF[diff];
  const mt=elapsed<d.tierDelay[0]?1:elapsed<d.tierDelay[1]?2:3;
  const av=Object.entries(RECIPES).filter(([,r])=>r.tier<=mt);
  const[n,r]=av[~~(Math.random()*av.length)];
  const look=CUSTOMER_STYLES[~~(Math.random()*CUSTOMER_STYLES.length)];
  return{id:Date.now()+Math.random(),drink:n,recipe:r,
    patience:Math.round((32+r.ing.length*9)*d.patMul),elapsed:0,
    cust:{name:CUST[~~(Math.random()*CUST.length)],skin:CUSTOMER_SKINS[~~(Math.random()*CUSTOMER_SKINS.length)],shirt:look.shirt,accent:look.accent,hair:look.hair}};
}

function mkTutorialOrder(drink,stepIdx=0){
  const recipe=RECIPES[drink];
  return {
    id:`tutorial-${stepIdx}-${drink}`,
    drink,
    recipe,
    patience:999,
    elapsed:0,
    cust:{
      name:CAT_COACH.name,
      skin:CAT_COACH.skin,
      shirt:CAT_COACH.shirt,
      accent:CAT_COACH.accent,
      hair:CAT_COACH.hair,
    },
  };
}

// â”€â”€â”€ JOYSTICK â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function createPlayerState(id, r, c, charId){
  const charDef=charId?CHARACTERS.find(ch=>ch.id===charId):null;
  return {
    id,
    r,
    c,
    dir:"down",
    holding:null,
    processing:null,
    af:0,
    vr:r,
    vc:c,
    squash:{sx:1,sy:1,t:0},
    clr:charDef?charToClr(charDef,id):(PLAYER_STYLES[id] || PLAYER_STYLES[0]),
  };
}

function createGameState(playerCount, diff, mapKey="classic", charIds=[]){
  const mapDef=setActiveMap(mapKey);
  const counters = {};
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      if (MAP[r][c].type === "counter") {
        counters[`${r},${c}`] = null;
      }
    }
  }

  return {
    mapKey:mapDef.id,
    players:[
      createPlayerState(0, ...(mapDef.spawns[0]||[4,6]), charIds[0]),
      ...(playerCount===2 ? [createPlayerState(1, ...(mapDef.spawns[1]||[4,11]), charIds[1])] : []),
    ],
    orders:[mkOrder(0, diff)],
    score:0,
    combo:0,
    comboT:0,
    flow:0,
    rushEnd:0,
    freezeEnd:0,
    timeLeft:DIFF[diff].time,
    elapsed:0,
    nextOrd:DIFF[diff].spawnBase-2,
    shake:{x:0,y:0,mag:0},
    counters,
    popups:[],
    over:false,
  };
}

function toHudState(gameState){
  const now=Date.now();
  return {
    score:gameState.score,
    time:gameState.timeLeft,
    combo:gameState.combo,
    flow:gameState.flow||0,
    rushLeft:Math.max(0,Math.ceil(((gameState.rushEnd||0)-now)/1000)),
    freezeLeft:Math.max(0,Math.ceil(((gameState.freezeEnd||0)-now)/1000)),
    orders:[...gameState.orders],
    holding:gameState.players.map((player)=>player.holding),
  };
}

function serializeGameState(gameState){
  const now = Date.now();
  return {
    ...gameState,
    rushEnd:Math.max(0,(gameState.rushEnd||0)-now),
    freezeEnd:Math.max(0,(gameState.freezeEnd||0)-now),
    counters:{...gameState.counters},
    orders:gameState.orders.map((order)=>({...order})),
    popups:gameState.popups.map((popup)=>({...popup})),
    players:gameState.players.map((player)=>({
      ...player,
      holding:player.holding ? {
        ...player.holding,
        ingredients:[...(player.holding.ingredients || [])],
      } : null,
      processing:player.processing ? {
        ...player.processing,
        remaining:Math.max(0, player.processing.end - now),
      } : null,
    })),
  };
}

function reviveGameState(snapshot){
  const now = Date.now();
  return {
    ...snapshot,
    rushEnd:now + (snapshot.rushEnd || 0),
    freezeEnd:now + (snapshot.freezeEnd || 0),
    counters:{...(snapshot.counters || {})},
    orders:(snapshot.orders || []).map((order)=>({...order})),
    popups:(snapshot.popups || []).map((popup)=>({...popup})),
    players:(snapshot.players || []).map((player)=>({
      ...player,
      holding:player.holding ? {
        ...player.holding,
        ingredients:[...(player.holding.ingredients || [])],
      } : null,
      processing:player.processing ? {
        ...player.processing,
        end:now + (player.processing.remaining || 0),
      } : null,
      clr:player.clr || PLAYER_STYLES[player.id] || PLAYER_STYLES[0],
    })),
  };
}

function cellKey(r,c){return `${r},${c}`;}

function findPath(start, isGoal, isBlocked){
  const q=[start];
  const seen=new Set([cellKey(start.r,start.c)]);
  const prev=new Map();

  while(q.length){
    const cur=q.shift();
    if(isGoal(cur.r,cur.c)){
      const dirs=[];
      let key=cellKey(cur.r,cur.c);
      while(prev.has(key)){
        const step=prev.get(key);
        dirs.push(step.dir);
        key=step.from;
      }
      return dirs.reverse();
    }

    for(const [dir,[dr,dc]] of Object.entries(DIRS)){
      const nr=cur.r+dr,nc=cur.c+dc;
      const key=cellKey(nr,nc);
      if(seen.has(key)||isBlocked(nr,nc))continue;
      seen.add(key);
      prev.set(key,{from:cellKey(cur.r,cur.c),dir});
      q.push({r:nr,c:nc});
    }
  }

  return null;
}

function Joystick({onMove,color,label,side,size=130}){
  const joyRef=useRef(null);const stick=useRef({active:false,cx:0,cy:0,dx:0,dy:0});
  const moveIv=useRef(null);const lastDir=useRef(null);
  const stickSz = Math.round(size * 0.42);
  const maxR = Math.round(size * 0.34);

  const getDir=(dx,dy)=>{if(Math.sqrt(dx*dx+dy*dy)<18)return null;if(Math.abs(dx)>Math.abs(dy))return dx>0?"right":"left";return dy>0?"down":"up";};

  useEffect(()=>()=>{if(moveIv.current)clearInterval(moveIv.current);},[]);

  const startMove=(dir)=>{if(moveIv.current)clearInterval(moveIv.current);onMove(dir);moveIv.current=setInterval(()=>onMove(dir),170);lastDir.current=dir;};
  const stopMove=()=>{if(moveIv.current){clearInterval(moveIv.current);moveIv.current=null;}lastDir.current=null;};

  const updateStick=()=>{
    const el=joyRef.current?.querySelector('.jstick');
    if(el)el.style.transform=`translate(${stick.current.dx}px,${stick.current.dy}px)`;
  };

  const onTS=(e)=>{
    e.preventDefault();const rect=joyRef.current.getBoundingClientRect();const t=e.touches[0];
    stick.current={active:true,cx:rect.left+rect.width/2,cy:rect.top+rect.height/2,dx:0,dy:0};
    const dx=t.clientX-stick.current.cx,dy=t.clientY-stick.current.cy;
    stick.current.dx=dx;stick.current.dy=dy;updateStick();
    const dir=getDir(dx,dy);if(dir)startMove(dir);
  };
  const onTM=(e)=>{
    e.preventDefault();if(!stick.current.active)return;const t=e.touches[0];
    let dx=t.clientX-stick.current.cx,dy=t.clientY-stick.current.cy;
    const dist=Math.sqrt(dx*dx+dy*dy);
    if(dist>maxR){dx=dx/dist*maxR;dy=dy/dist*maxR;}
    stick.current.dx=dx;stick.current.dy=dy;updateStick();
    const dir=getDir(dx,dy);
    if(dir&&dir!==lastDir.current){stopMove();startMove(dir);}
    else if(!dir)stopMove();
  };
  const onTE=(e)=>{e.preventDefault();stick.current={...stick.current,active:false,dx:0,dy:0};stopMove();updateStick();};

  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,...(side==="left"?{marginLeft:8}:{marginRight:8})}}>
      <div ref={joyRef} onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}
        style={{width:size,height:size,borderRadius:"50%",background:`radial-gradient(circle,${color}18 0%,${color}08 60%,transparent 100%)`,border:`3px solid ${color}35`,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",touchAction:"none"}}>
        <div className="jstick" style={{width:stickSz,height:stickSz,borderRadius:"50%",background:`radial-gradient(circle at 40% 35%,${color}cc,${color}88)`,boxShadow:`0 2px 10px ${color}44,inset 0 2px 4px ${color}ff`,transition:"transform 0.04s linear",position:"absolute"}}/>
        {["U","D","L","R"].map((a,i)=><span key={i} style={{position:"absolute",color:color+"44",fontSize:Math.max(9,size*0.08),fontWeight:"bold",...[{top:6},{bottom:6},{left:6},{right:6}][i]}}>{a}</span>)}
      </div>
      <span style={{fontSize:8,color:color+"99",fontFamily:"'Silkscreen',monospace",letterSpacing:1}}>{label}</span>
    </div>
  );
}

function ActBtn({onAction,color,holding,sz=80}){
  const[p,sP]=useState(false);
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
      <button onTouchStart={e=>{e.preventDefault();sP(true);onAction();haptic("medium");}}
        onTouchEnd={e=>{e.preventDefault();sP(false);}}
        onPointerDown={e=>{if(e.pointerType!=="touch"){sP(true);onAction();}}} onPointerUp={()=>sP(false)}
        style={{width:sz,height:sz,borderRadius:"50%",
          background:p?`radial-gradient(circle,${color},${color}aa)`:`radial-gradient(circle at 40% 35%,${color}cc,${color}66)`,
          border:`3px solid ${p?color:color+"88"}`,boxShadow:p?`0 0 24px ${color}66`:`0 4px 14px ${color}33`,
          color:P.white,fontSize:sz*.15,fontWeight:"bold",fontFamily:"'Silkscreen',monospace",
          display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
          cursor:"pointer",touchAction:"manipulation",userSelect:"none",WebkitUserSelect:"none",
          transform:p?"scale(0.88)":"scale(1)",transition:"transform .08s,box-shadow .08s",gap:2}}>
        <span style={{fontSize:sz*.18,letterSpacing:1}}>ACT</span>
      </button>
      {holding&&<div style={{background:"#000a",borderRadius:8,padding:"3px 8px",display:"flex",gap:2,alignItems:"center"}}>
        {holding.ingredients?.length===0?<span style={{fontSize:10,fontFamily:"'Silkscreen',monospace",color:"#f5e6d3"}}>CUP</span>:
          holding.ingredients?.map((ing,i)=><div key={i} style={{width:10,height:10,borderRadius:2,background:ING_C[ing],border:"1px solid #fff3"}}/>)}
      </div>}
    </div>
  );
}

function DPad({pid,onInput,label,color}){
  const sz=44;const fire=d=>e=>{e.preventDefault();onInput(pid,d);};
  const bs=a=>({width:sz,height:sz,borderRadius:a?12:6,background:a?color+"33":"#3a2215",border:`2px solid ${a?color:color+"55"}`,color,fontSize:a?10:16,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",userSelect:"none",WebkitUserSelect:"none",touchAction:"manipulation",fontFamily:"'Silkscreen',monospace",fontWeight:"bold"});
  return (<div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
    <span style={{fontSize:8,color,fontFamily:"'Silkscreen',monospace"}}>{label}</span>
    <div style={{display:"grid",gridTemplateColumns:`repeat(3,${sz}px)`,gridTemplateRows:`repeat(3,${sz}px)`,gap:2}}>
      <div/><div style={bs()} onPointerDown={fire("up")}>U</div><div/>
      <div style={bs()} onPointerDown={fire("left")}>L</div><div style={bs(true)} onPointerDown={fire("action")}>ACT</div><div style={bs()} onPointerDown={fire("right")}>R</div>
      <div/><div style={bs()} onPointerDown={fire("down")}>D</div><div/>
    </div>
  </div>);
}

function OrderTicket({o,compact}){
  const pct=1-o.elapsed/o.patience;const urg=pct<.25;
  return (<div style={{background:compact?(urg?"linear-gradient(180deg,#3a0a0ad8 0%,#241008cc 100%)":"linear-gradient(180deg,#322014d8 0%,#211309cc 100%)"):(urg?"linear-gradient(180deg,#3a0a0a 0%,#241008 100%)":"linear-gradient(180deg,#322014 0%,#211309 100%)"),border:`2px solid ${pct>.5?"#8b5e34":pct>.25?P.orange:P.red}`,borderRadius:10,padding:compact?"6px 9px":"8px 12px",minWidth:compact?122:152,flexShrink:0,animation:urg?"pulse .6s infinite":undefined,boxShadow:"0 4px 10px #00000033",backdropFilter:compact?"blur(6px)":undefined}}>
    <div style={{display:"flex",alignItems:"center",gap:4}}>
      <div style={{width:compact?12:16,height:compact?12:16,borderRadius:"50%",background:o.cust.skin,border:"1px solid #0003",boxShadow:"inset 0 1px 0 #ffffff33"}}/>
      <span style={{color:"#d8b48c",fontSize:compact?7:8,fontFamily:"'Silkscreen',monospace"}}>{o.cust.name}</span>
    </div>
    <div style={{color:getRecipeUiColor(o.drink),fontSize:compact?10:10,marginTop:4,fontWeight:"bold",fontFamily:"'Silkscreen',monospace",whiteSpace:"nowrap",textShadow:"0 1px 0 #120904"}}>{o.drink}</div>
    <div style={{height:5,background:"#0a0604",borderRadius:3,marginTop:6,overflow:"hidden"}}>
      <div style={{height:"100%",width:`${pct*100}%`,borderRadius:2,background:pct>.5?P.green:pct>.25?P.orange:P.red,transition:"width 1s linear"}}/>
    </div>
    <div style={{display:"flex",gap:4,marginTop:5,flexWrap:"wrap"}}>
      {o.recipe.ing.map((ing,i)=><div key={i} style={{width:compact?11:13,height:compact?11:13,borderRadius:2,background:ING_C[ing],border:"1px solid #fff2",boxShadow:"inset 0 1px 0 #ffffff33"}}/>)}
    </div>
  </div>);
}

function FocusOrderCard({order,onToggleQueue,queueCount=0}){
  if(!order){
    return (
      <button onClick={onToggleQueue} style={{fontFamily:"'Silkscreen',monospace",background:"linear-gradient(180deg,#28160dd4 0%,#160c08bf 100%)",border:"1px solid #7d5b3d55",borderRadius:18,padding:"8px 12px",minWidth:168,color:"#d8b48c",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,boxShadow:"0 10px 20px #00000024",backdropFilter:"blur(16px) saturate(1.15)",cursor:"pointer"}}>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:4}}>
          <span style={{fontSize:8,color:"#8a6a4a"}}>ORDERS</span>
          <span style={{fontSize:10,color:"#f5e6d3"}}>Waiting...</span>
        </div>
        <span style={{fontSize:7,color:"#b58a64"}}>QUEUE</span>
      </button>
    );
  }
  const pct=clamp(1-order.elapsed/order.patience,0,1);
  const accent=pct>.5?P.green:pct>.25?P.orange:P.red;
  return (
    <button onClick={onToggleQueue} style={{fontFamily:"'Silkscreen',monospace",background:"linear-gradient(180deg,#342013c1 0%,#190f0ab3 100%)",border:`1px solid ${accent}77`,borderRadius:18,padding:"8px 12px",minWidth:182,maxWidth:236,color:"#f5e6d3",display:"flex",flexDirection:"column",gap:5,boxShadow:"0 10px 22px #00000024",backdropFilter:"blur(18px) saturate(1.2)",cursor:"pointer",textAlign:"left"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:6,minWidth:0}}>
          <div style={{width:13,height:13,borderRadius:"50%",background:order.cust.skin,border:"1px solid #0004",boxShadow:"inset 0 1px 0 #ffffff22",flexShrink:0}}/>
          <span style={{fontSize:8,color:"#d8b48c",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{order.cust.name}</span>
        </div>
        <span style={{fontSize:7,color:"#b58a64",flexShrink:0}}>QUEUE {queueCount+1}</span>
      </div>
      <div style={{fontSize:10,color:getRecipeUiColor(order.drink),whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",textShadow:"0 1px 0 #120904"}}>{order.drink}</div>
      <div style={{height:5,borderRadius:999,background:"#0d0705",overflow:"hidden",boxShadow:"inset 0 1px 3px #00000066"}}>
        <div style={{width:`${pct*100}%`,height:"100%",borderRadius:999,background:accent,boxShadow:`0 0 12px ${accent}55`,transition:"width 1s linear"}}/>
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {order.recipe.ing.map((ing,i)=><div key={i} style={{width:10,height:10,borderRadius:3,background:ING_C[ing],border:"1px solid #fff2",boxShadow:"inset 0 1px 0 #ffffff22"}}/>)}
        </div>
        <span style={{fontSize:6,color:"#cba27b",flexShrink:0}}>FULL QUEUE</span>
      </div>
    </button>
  );
}

function OrderQueueChip({order,extraLabel,onClick}){
  if(extraLabel){
    return (
      <button onClick={onClick} style={{fontFamily:"'Silkscreen',monospace",background:"#201109b8",border:"1px solid #6b3a1f66",borderRadius:999,padding:"7px 10px",minWidth:48,color:"#d8b48c",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,boxShadow:"0 10px 22px #00000024",backdropFilter:"blur(12px) saturate(1.1)",cursor:"pointer"}}>
        {extraLabel}
      </button>
    );
  }
  const pct=clamp(1-order.elapsed/order.patience,0,1);
  const accent=pct>.5?P.green:pct>.25?P.orange:P.red;
  return (
    <button onClick={onClick} style={{fontFamily:"'Silkscreen',monospace",background:"#201109aa",border:`1px solid ${accent}66`,borderRadius:999,padding:"6px 9px",minWidth:70,color:"#f5e6d3",display:"flex",flexDirection:"column",gap:4,alignItems:"flex-start",boxShadow:"0 10px 22px #00000024",backdropFilter:"blur(12px) saturate(1.1)",cursor:"pointer"}}>
      <span style={{fontSize:8,color:getRecipeUiColor(order.drink),lineHeight:1.2}}>{shortDrinkLabel(order.drink)}</span>
      <div style={{width:"100%",height:4,borderRadius:999,background:"#0d0705",overflow:"hidden"}}>
        <div style={{width:`${pct*100}%`,height:"100%",borderRadius:999,background:accent,transition:"width 1s linear"}}/>
      </div>
    </button>
  );
}

function MobileUtilityMenu({appShell,audioUi,onClose}){
  const hasInstall=!!appShell?.showInstallAction;
  const hasFullscreen=!!appShell?.showFullscreenAction;
  const hasMenu=hasInstall||hasFullscreen||audioUi;
  if(!hasMenu)return null;
  const btnStyle=(active=true)=>({
    fontFamily:"'Silkscreen',monospace",
    fontWeight:"bold",
    fontSize:9,
    padding:"10px 12px",
    borderRadius:12,
    cursor:"pointer",
    border:`1px solid ${active?"#d2a97966":"#6b3a1f55"}`,
    background:active?"#24140ddd":"#180d08c7",
    color:active?"#f5e6d3":"#9c7b5d",
    boxShadow:"0 8px 18px #00000024",
  });
  return (
    <div onPointerDown={onClose} onTouchStart={onClose} style={{position:"absolute",inset:0,pointerEvents:"auto"}}>
      <div onPointerDown={(e)=>e.stopPropagation()} onTouchStart={(e)=>e.stopPropagation()} style={{position:"absolute",top:"calc(max(env(safe-area-inset-top), 10px) + 48px)",right:"max(env(safe-area-inset-right), 10px)",display:"flex",flexDirection:"column",gap:8,minWidth:156,padding:"10px",borderRadius:18,background:"linear-gradient(180deg,#22120cd9 0%,#120904cc 100%)",border:"1px solid #c89f7340",boxShadow:"0 18px 36px #0000003a",backdropFilter:"blur(18px) saturate(1.2)"}}>
        {hasInstall&&<button onClick={()=>{appShell.promptInstall();onClose();}} style={btnStyle(true)}>INSTALL APP</button>}
        {hasFullscreen&&<button onClick={()=>{appShell.toggleFullscreen();onClose();}} style={btnStyle(true)}>{appShell.isFullscreen?"EXIT FULL":"FULLSCREEN"}</button>}
        {audioUi&&<button onClick={audioUi.toggleMusic} disabled={!audioUi.hasMusic} style={btnStyle(!!audioUi.hasMusic)}>{audioUi.hasMusic?(audioUi.prefs.music?"MUSIC ON":"MUSIC OFF"):"ADD MUSIC"}</button>}
        {audioUi&&<button onClick={audioUi.toggleSfx} style={btnStyle(true)}>{audioUi.prefs.sfx?"SFX ON":"SFX OFF"}</button>}
        {audioUi?.hasMultipleTracks&&<button onClick={audioUi.nextTrack} style={btnStyle(true)}>NEXT SONG</button>}
      </div>
    </div>
  );
}

function ShellActionRow({appShell,compact=false,align="center"}){
  if(!appShell||(!appShell.showInstallAction&&!appShell.showFullscreenAction))return null;
  const screen=useScreen();
  const isMobile=screen.w<900;
  const mobileLandscape=isMobile&&screen.w>screen.h;
  const btnStyle={
    fontFamily:"'Silkscreen',monospace",
    fontWeight:"bold",
    fontSize:compact?(isMobile?(mobileLandscape?10:11):8):(isMobile?(mobileLandscape?11:12):10),
    padding:compact?(isMobile?(mobileLandscape?"8px 12px":"9px 14px"):"6px 10px"):(isMobile?(mobileLandscape?"9px 14px":"11px 16px"):"8px 12px"),
    borderRadius:999,
    cursor:"pointer",
    border:"1px solid #6b3a1f88",
    background:"#120904dd",
    color:"#f5e6d3",
    boxShadow:"0 6px 16px #0000002a",
  };
  return (
    <div style={{display:"flex",gap:6,justifyContent:align,flexWrap:"wrap"}}>
      {appShell.showInstallAction&&<button onClick={appShell.promptInstall} style={btnStyle}>INSTALL APP</button>}
      {appShell.showFullscreenAction&&<button onClick={appShell.toggleFullscreen} style={btnStyle}>{appShell.isFullscreen?"EXIT FULLSCREEN":"FULLSCREEN"}</button>}
    </div>
  );
}

function AudioToggleRow({audioUi,compact=false,align="center"}){
  if(!audioUi)return null;
  const screen=useScreen();
  const isMobile=screen.w<900;
  const mobileLandscape=isMobile&&screen.w>screen.h;
  const btn=(active,disabled)=>({
    fontFamily:"'Silkscreen',monospace",
    fontWeight:"bold",
    fontSize:compact?(isMobile?(mobileLandscape?10:11):8):(isMobile?(mobileLandscape?11:12):10),
    padding:compact?(isMobile?(mobileLandscape?"8px 12px":"9px 14px"):"6px 10px"):(isMobile?(mobileLandscape?"9px 14px":"11px 16px"):"8px 12px"),
    borderRadius:999,
    cursor:disabled?"default":"pointer",
    border:`1px solid ${active?"#d2a979aa":"#6b3a1f88"}`,
    background:disabled?"#12090488":active?"#2d1b0e":"#120904dd",
    color:disabled?"#7a5b45":active?"#f5e6d3":"#b58a64",
    boxShadow:"0 6px 16px #0000002a",
    opacity:disabled?0.7:1,
  });
  return (
    <div style={{display:"flex",gap:6,justifyContent:align,flexWrap:"wrap"}}>
      <button onClick={audioUi.toggleMusic} disabled={!audioUi.hasMusic} style={btn(audioUi.prefs.music,!audioUi.hasMusic)}>
        {audioUi.hasMusic?(audioUi.prefs.music?"MUSIC ON":"MUSIC OFF"):"ADD MUSIC"}
      </button>
      <button onClick={audioUi.toggleSfx} style={btn(audioUi.prefs.sfx,false)}>
        {audioUi.prefs.sfx?"SFX ON":"SFX OFF"}
      </button>
      {audioUi.hasMultipleTracks&&<button onClick={audioUi.nextTrack} style={btn(true,false)}>{compact?"NEXT":"NEXT SONG"}</button>}
    </div>
  );
}

function PowerMeter({hud,compact=false,align="center"}){
  if(!hud)return null;
  const pct=clamp((hud.flow||0)/POWER_RULES.maxFlow,0,1);
  const active=[];
  if(hud.rushLeft>0)active.push(`RUSH ${hud.rushLeft}s`);
  if(hud.freezeLeft>0)active.push(`FREEZE ${hud.freezeLeft}s`);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:compact?3:4,alignItems:align==="center"?"center":"stretch",minWidth:compact?132:188}}>
      <div style={{display:"flex",width:"100%",alignItems:"center",justifyContent:"space-between",gap:8,fontFamily:"'Silkscreen',monospace"}}>
        <span style={{fontSize:compact?8:9,color:"#ffcf7a"}}>FLOW</span>
        <span style={{fontSize:compact?8:9,color:"#f5e6d3"}}>{Math.round(hud.flow||0)}/{POWER_RULES.maxFlow}</span>
      </div>
      <div style={{width:"100%",height:compact?8:10,borderRadius:999,background:"#0f0704",border:"1px solid #6b3a1f88",overflow:"hidden",boxShadow:"inset 0 1px 3px #00000066"}}>
        <div style={{width:`${pct*100}%`,height:"100%",background:"linear-gradient(90deg,#ff8a50 0%,#ffd54f 52%,#8be9ff 100%)",boxShadow:"0 0 14px #ffd54f66"}}/>
      </div>
      {!!active.length&&<div style={{fontSize:compact?7:8,color:"#9de7ff",textAlign:align,lineHeight:1.5}}>{active.join(" / ")}</div>}
    </div>
  );
}

function PowerButtons({hud,onUsePower,compact=false,stack=false}){
  if(!hud||!onUsePower)return null;
  const rushDisabled=(hud.flow||0)<POWER_RULES.rushCost||hud.rushLeft>0;
  const freezeDisabled=(hud.flow||0)<POWER_RULES.freezeCost||hud.freezeLeft>0;
  const base={
    fontFamily:"'Silkscreen',monospace",
    fontWeight:"bold",
    fontSize:compact?8:9,
    padding:compact?"7px 10px":"8px 12px",
    borderRadius:14,
    cursor:"pointer",
    minWidth:compact?78:104,
    touchAction:"manipulation",
  };
  const fire=(kind)=>()=>{
    onUsePower(kind);
    haptic("medium");
  };
  return (
    <div style={{display:"flex",flexDirection:stack?"column":"row",gap:6,alignItems:"center",justifyContent:"center"}}>
      <button onClick={fire("rush")} disabled={rushDisabled} style={{...base,border:`1px solid ${rushDisabled?"#7a5234":"#ffb74d88"}`,background:rushDisabled?"#12090488":"linear-gradient(180deg,#4a2814 0%,#2a160b 100%)",color:rushDisabled?"#7a5b45":"#ffd28a",boxShadow:rushDisabled?"none":"0 6px 16px #ff8a5022"}}>
        {hud.rushLeft>0?`RUSH ${hud.rushLeft}s`:compact?"RUSH":"RUSH 45"}
      </button>
      <button onClick={fire("freeze")} disabled={freezeDisabled} style={{...base,border:`1px solid ${freezeDisabled?"#4d6170":"#81d4fa88"}`,background:freezeDisabled?"#12090488":"linear-gradient(180deg,#162a39 0%,#0f1821 100%)",color:freezeDisabled?"#5d7381":"#b8eeff",boxShadow:freezeDisabled?"none":"0 6px 16px #4fc3f722"}}>
        {hud.freezeLeft>0?`FREEZE ${hud.freezeLeft}s`:compact?"FREEZE":"FREEZE 90"}
      </button>
    </div>
  );
}

function MapLogo({deco,size=48}){
  const s=size/16;
  if(deco==="sunbooks"){
    // Starbucks-parody circle logo with cup
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" style={{display:"block"}}>
        <circle cx="8" cy="8" r="7.5" fill="#1a5c3a"/>
        <circle cx="8" cy="8" r="6" fill="#246b45"/>
        <circle cx="8" cy="8" r="5" stroke="#f4e8cf" strokeWidth=".6" fill="none"/>
        {/* coffee cup */}
        <rect x="6" y="5" width="4" height="5" rx=".5" fill="#f4e8cf"/>
        <rect x="6.5" y="4.5" width="3" height="1" rx=".3" fill="#f4e8cf"/>
        <rect x="10" y="6" width="1.5" height="2.5" rx=".8" fill="none" stroke="#f4e8cf" strokeWidth=".5"/>
        {/* steam */}
        <path d="M7.2,3.5 Q7.5,2.5 7.8,3 Q8.1,2 8.5,3 Q8.8,2.2 9,3.2" stroke="#f4e8cf" strokeWidth=".4" fill="none" opacity=".7"/>
        {/* star */}
        <rect x="7.5" y="6.5" width="1" height="1" fill="#1a5c3a"/>
      </svg>
    );
  }
  if(deco==="catcafe"){
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" style={{display:"block"}}>
        {/* cat face */}
        <polygon points="3,7 5,1 7.5,6.5" fill="#f0c070"/>
        <polygon points="8.5,6.5 11,1 13,7" fill="#f0c070"/>
        <polygon points="4,6 6,2.5 7,6" fill="#f0a0a0"/>
        <polygon points="9,6 10,2.5 12,6" fill="#f0a0a0"/>
        <ellipse cx="8" cy="10" rx="5.5" ry="5" fill="#f0c070"/>
        {/* eyes */}
        <ellipse cx="5.8" cy="9" rx="1" ry="1.2" fill="#332014"/>
        <ellipse cx="10.2" cy="9" rx="1" ry="1.2" fill="#332014"/>
        <circle cx="6.2" cy="8.5" r=".5" fill="#fff"/>
        <circle cx="10.6" cy="8.5" r=".5" fill="#fff"/>
        {/* nose & mouth */}
        <ellipse cx="8" cy="11" rx=".8" ry=".6" fill="#e08888"/>
        <line x1="6.5" y1="12" x2="8" y2="12.8" stroke="#a06040" strokeWidth=".5" strokeLinecap="round"/>
        <line x1="9.5" y1="12" x2="8" y2="12.8" stroke="#a06040" strokeWidth=".5" strokeLinecap="round"/>
        {/* whiskers */}
        <line x1="1" y1="9.5" x2="4.5" y2="10.2" stroke="#c4956a" strokeWidth=".3" opacity=".6"/>
        <line x1="1" y1="11" x2="4.5" y2="10.8" stroke="#c4956a" strokeWidth=".3" opacity=".6"/>
        <line x1="15" y1="9.5" x2="11.5" y2="10.2" stroke="#c4956a" strokeWidth=".3" opacity=".6"/>
        <line x1="15" y1="11" x2="11.5" y2="10.8" stroke="#c4956a" strokeWidth=".3" opacity=".6"/>
        {/* coffee cup on head */}
        <rect x="6.5" y="4.5" width="3" height="2" rx=".3" fill="#fff"/>
        <rect x="7" y="5" width="2" height="1" fill="#8b5e3c"/>
      </svg>
    );
  }
  if(deco==="centralperks"){
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" style={{display:"block"}}>
        {/* night sky */}
        <rect x="0" y="0" width="16" height="16" rx="2" fill="#1a2a40"/>
        {/* skyline buildings */}
        <rect x="1" y="5" width="2.5" height="11" fill="#2a3a4a"/>
        <rect x="2" y="3" width="1.5" height="2" fill="#2a3a4a"/>
        <rect x="4" y="4" width="2" height="12" fill="#344858"/>
        <rect x="6.5" y="2" width="2" height="14" fill="#2a3a4a"/>
        <rect x="7" y="0.5" width="1" height="1.5" fill="#3a4a5a"/>
        <rect x="9" y="6" width="2.5" height="10" fill="#344858"/>
        <rect x="12" y="3.5" width="2.5" height="12.5" fill="#2a3a4a"/>
        <rect x="13" y="2" width="1" height="1.5" fill="#3a4a5a"/>
        {/* windows */}
        {[1.5,2.5,4.5,5,7,7.5,9.5,10.5,12.5,13.5].map((wx,i)=>
          [6,8,10,12].map((wy,j)=>
            <rect key={`${i}-${j}`} x={wx} y={wy} width=".7" height=".6" fill={(i+j)%3===0?"#ffe480":"#ffd06088"} opacity={(i*j)%4===0?.3:.7}/>
          )
        )}
        {/* stars */}
        <rect x="3.5" y="1" width=".5" height=".5" fill="#fff8d0" opacity=".6"/>
        <rect x="11" y="1.5" width=".5" height=".5" fill="#fff8d0" opacity=".5"/>
        {/* moon */}
        <circle cx="14.5" cy="1.5" r="1" fill="#fff8d0" opacity=".7"/>
      </svg>
    );
  }
  if(deco==="halloween"){
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" style={{display:"block"}}>
        <rect x="0" y="0" width="16" height="16" rx="2" fill="#1a0a20"/>
        {/* moon */}
        <circle cx="12" cy="3.5" r="2.5" fill="#ffe066" opacity=".8"/>
        <circle cx="13" cy="3" r="2" fill="#1a0a20"/>
        {/* pumpkin */}
        <ellipse cx="8" cy="11" rx="4.5" ry="3.5" fill="#ff8c00"/>
        <ellipse cx="8" cy="11" rx="3" ry="3" fill="#ff6600"/>
        <rect x="7" y="7" width="2" height="2" rx=".5" fill="#2a8020"/>
        {/* face */}
        <polygon points="5,10 6,9 7,10.5" fill="#ffe066"/>
        <polygon points="9,10.5 10,9 11,10" fill="#ffe066"/>
        <rect x="6" y="12" width="4" height="1" fill="#ffe066"/>
        <rect x="7" y="13" width="2" height=".8" fill="#ffe066"/>
        {/* bat */}
        <rect x="2" y="5" width="1.5" height=".8" fill="#1a0a1888"/>
        <rect x="4" y="5" width="1.5" height=".8" fill="#1a0a1888"/>
        <rect x="3.5" y="4.5" width=".8" height="1.5" fill="#1a0a18"/>
      </svg>
    );
  }
  if(deco==="winter"){
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" style={{display:"block"}}>
        <rect x="0" y="0" width="16" height="16" rx="2" fill="#1a2a40"/>
        {/* snow ground */}
        <ellipse cx="8" cy="15" rx="8" ry="3" fill="#d0e4f0"/>
        {/* Christmas tree */}
        <polygon points="8,1.5 4,7 12,7" fill="#1a6030"/>
        <polygon points="8,4 3.5,9.5 12.5,9.5" fill="#1a6030"/>
        <polygon points="8,6.5 3,12 13,12" fill="#1a6030"/>
        <rect x="7" y="12" width="2" height="2" fill="#5a3a20"/>
        {/* star */}
        <rect x="7.3" y="0.5" width="1.4" height="1.4" fill="#ffcc00" transform="rotate(45 8 1.2)"/>
        {/* ornaments */}
        <circle cx="6" cy="5.5" r=".7" fill="#ff4444"/>
        <circle cx="10" cy="5.5" r=".7" fill="#4488ff"/>
        <circle cx="5.5" cy="8" r=".7" fill="#ffcc00"/>
        <circle cx="10.5" cy="8" r=".7" fill="#ff44ff"/>
        <circle cx="7" cy="10" r=".7" fill="#44ff44"/>
        <circle cx="9.5" cy="10.5" r=".7" fill="#ff4444"/>
        {/* snowflakes */}
        <rect x="2" y="3" width=".8" height=".8" fill="#fff" opacity=".6"/>
        <rect x="13" y="2" width=".8" height=".8" fill="#fff" opacity=".5"/>
        <rect x="1" y="8" width=".6" height=".6" fill="#fff" opacity=".4"/>
        <rect x="14" y="7" width=".6" height=".6" fill="#fff" opacity=".5"/>
      </svg>
    );
  }
  if(deco==="eid"){
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" style={{display:"block"}}>
        <rect x="0" y="0" width="16" height="16" rx="2" fill="#0a1830"/>
        {/* crescent moon */}
        <circle cx="8" cy="5" r="3.5" fill="#d4af37"/>
        <circle cx="9.5" cy="4.2" r="3" fill="#0a1830"/>
        {/* star next to crescent */}
        <rect x="11" y="3.5" width="1" height="1" fill="#d4af37" transform="rotate(45 11.5 4)"/>
        <rect x="11.3" y="2.5" width=".4" height="3" fill="#d4af37"/>
        <rect x="10" y="3.8" width="3" height=".4" fill="#d4af37"/>
        {/* mosque dome */}
        <path d="M3,14 L3,10 Q5.5,6 8,10 Q10.5,6 13,10 L13,14 Z" fill="#142848"/>
        <ellipse cx="8" cy="9.5" rx="3" ry="2.5" fill="#1a3858"/>
        {/* minaret */}
        <rect x="2" y="8" width="1.5" height="6" fill="#142848"/>
        <rect x="1.8" y="7.5" width="1.9" height="1" rx=".5" fill="#142848"/>
        <rect x="12.5" y="8" width="1.5" height="6" fill="#142848"/>
        <rect x="12.3" y="7.5" width="1.9" height="1" rx=".5" fill="#142848"/>
        {/* golden details */}
        <rect x="2.3" y="7" width="1" height=".5" fill="#d4af37"/>
        <rect x="12.7" y="7" width="1" height=".5" fill="#d4af37"/>
        <rect x="7.5" y="9" width="1" height=".5" fill="#d4af37"/>
        {/* lanterns */}
        <rect x="4.5" y="11" width="1" height="1.5" fill="#d4af37"/>
        <rect x="4.3" y="10.5" width="1.4" height=".6" fill="#d4af37"/>
        <rect x="4.7" y="11.3" width=".6" height=".8" fill="#ff880088"/>
        <rect x="10.5" y="11" width="1" height="1.5" fill="#d4af37"/>
        <rect x="10.3" y="10.5" width="1.4" height=".6" fill="#d4af37"/>
        <rect x="10.7" y="11.3" width=".6" height=".8" fill="#ff880088"/>
      </svg>
    );
  }
  // fallback
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{display:"block"}}>
      <rect x="0" y="0" width="16" height="16" rx="2" fill="#2d1b0e"/>
      <rect x="5" y="4" width="6" height="8" rx="1" fill="#f5e6d3"/>
      <rect x="6" y="5" width="4" height="2" fill="#8b5e3c"/>
    </svg>
  );
}

function CharacterPreview({char,size=64,selected=false,pid=0}){
  const s=size/16;
  const c=char;
  const accent=c.accent||"#888";
  if(c.type==="cat"){
    return (
      <svg width={size} height={size*1.2} viewBox="0 0 16 19" style={{display:"block"}}>
        {/* shadow */}
        <ellipse cx="8" cy="18" rx="5" ry="1" fill="#00000033"/>
        {/* body */}
        <rect x="4" y="9" width="8" height="5" rx="1" fill={c.apron}/>
        <rect x="4" y="14" width="3" height="3" fill={c.pants}/>
        <rect x="9" y="14" width="3" height="3" fill={c.pants}/>
        <rect x="5" y="17" width="2" height="1" fill={c.shoes}/>
        <rect x="9" y="17" width="2" height="1" fill={c.shoes}/>
        {/* arms */}
        <rect x="1" y="10" width="3" height="2" rx=".5" fill={c.fur}/>
        <rect x="12" y="10" width="3" height="2" rx=".5" fill={c.fur}/>
        {/* head */}
        <ellipse cx="8" cy="6" rx="5" ry="4.5" fill={c.fur}/>
        {/* ears */}
        <polygon points="3,4 5,0 7,4" fill={c.fur}/>
        <polygon points="9,4 11,0 13,4" fill={c.fur}/>
        <polygon points="4,3.5 5.5,1 6.5,3.5" fill={c.earInner}/>
        <polygon points="9.5,3.5 10.5,1 12,3.5" fill={c.earInner}/>
        {/* eyes */}
        <ellipse cx="6" cy="5.5" rx="1.2" ry="1.4" fill="#332014"/>
        <ellipse cx="10" cy="5.5" rx="1.2" ry="1.4" fill="#332014"/>
        <circle cx="6.4" cy="5" r=".5" fill="#fff"/>
        <circle cx="10.4" cy="5" r=".5" fill="#fff"/>
        {/* nose */}
        <ellipse cx="8" cy="7.2" rx=".8" ry=".5" fill={c.nose}/>
        {/* whiskers */}
        <line x1="0" y1="6.5" x2="4.5" y2="7" stroke="#c4956a" strokeWidth=".3" opacity=".5"/>
        <line x1="0" y1="7.5" x2="4.5" y2="7.5" stroke="#c4956a" strokeWidth=".3" opacity=".5"/>
        <line x1="16" y1="6.5" x2="11.5" y2="7" stroke="#c4956a" strokeWidth=".3" opacity=".5"/>
        <line x1="16" y1="7.5" x2="11.5" y2="7.5" stroke="#c4956a" strokeWidth=".3" opacity=".5"/>
        {/* tail */}
        <path d="M12,13 Q15,12 14,10" stroke={c.fur} strokeWidth="1.2" fill="none" strokeLinecap="round"/>
        {/* apron tie */}
        <rect x="7" y="10" width="2" height="2" rx=".5" fill="#fff"/>
      </svg>
    );
  }
  if(c.type==="girl"){
    return (
      <svg width={size} height={size*1.2} viewBox="0 0 16 19" style={{display:"block"}}>
        <ellipse cx="8" cy="18" rx="5" ry="1" fill="#00000033"/>
        {/* body */}
        <rect x="4" y="9" width="8" height="5" rx="1" fill={c.apron}/>
        <rect x="4" y="14" width="3" height="3" fill={c.pants}/>
        <rect x="9" y="14" width="3" height="3" fill={c.pants}/>
        <rect x="5" y="17" width="2" height="1" fill={c.shoes}/>
        <rect x="9" y="17" width="2" height="1" fill={c.shoes}/>
        {/* arms */}
        <rect x="1" y="10" width="3" height="2" rx=".5" fill={c.skin}/>
        <rect x="12" y="10" width="3" height="2" rx=".5" fill={c.skin}/>
        {/* head */}
        <ellipse cx="8" cy="5.5" rx="4.5" ry="4" fill={c.skin}/>
        {/* hair */}
        <ellipse cx="8" cy="3.5" rx="5" ry="3" fill={c.hair}/>
        <rect x="3" y="3.5" width="2" height="5" rx=".5" fill={c.hair}/>
        <rect x="11" y="3.5" width="2" height="5" rx=".5" fill={c.hair}/>
        {/* bow */}
        <polygon points="10,1.5 11.5,0.5 11.5,2.5" fill={c.bow}/>
        <polygon points="12.5,1.5 11.5,0.5 11.5,2.5" fill={c.bow}/>
        <circle cx="11.5" cy="1.5" r=".5" fill={c.bow}/>
        {/* eyes */}
        <ellipse cx="6" cy="5.5" rx="1.2" ry="1.5" fill="#332014"/>
        <ellipse cx="10" cy="5.5" rx="1.2" ry="1.5" fill="#332014"/>
        <circle cx="6.4" cy="5" r=".6" fill="#fff"/>
        <circle cx="10.4" cy="5" r=".6" fill="#fff"/>
        {/* blush */}
        <ellipse cx="4.5" cy="7" rx="1" ry=".5" fill="#ffaaaa55"/>
        <ellipse cx="11.5" cy="7" rx="1" ry=".5" fill="#ffaaaa55"/>
        {/* smile */}
        <path d="M6.5,7.5 Q8,9 9.5,7.5" stroke="#8d5a3b" strokeWidth=".6" fill="none" strokeLinecap="round"/>
        {/* apron tie */}
        <rect x="7" y="10" width="2" height="2" rx=".5" fill="#fff"/>
      </svg>
    );
  }
  if(c.type==="chef"){
    return (
      <svg width={size} height={size*1.2} viewBox="0 0 16 19" style={{display:"block"}}>
        <ellipse cx="8" cy="18" rx="5" ry="1" fill="#00000033"/>
        {/* body */}
        <rect x="4" y="9" width="8" height="5" rx="1" fill={c.apron}/>
        <rect x="4" y="14" width="3" height="3" fill={c.pants}/>
        <rect x="9" y="14" width="3" height="3" fill={c.pants}/>
        <rect x="5" y="17" width="2" height="1" fill={c.shoes}/>
        <rect x="9" y="17" width="2" height="1" fill={c.shoes}/>
        {/* arms */}
        <rect x="1" y="10" width="3" height="2" rx=".5" fill={c.skin}/>
        <rect x="12" y="10" width="3" height="2" rx=".5" fill={c.skin}/>
        {/* head */}
        <ellipse cx="8" cy="6" rx="4.5" ry="4" fill={c.skin}/>
        {/* tall chef hat */}
        <rect x="4" y="1" width="8" height="3" rx="1" fill="#fff"/>
        <rect x="5" y="-2" width="6" height="3.5" rx="1" fill="#fff"/>
        <rect x="6" y="-4" width="4" height="2.5" rx="1" fill="#fff"/>
        {/* spiky blonde hair */}
        <rect x="3" y="3" width="2" height="2" fill={c.hair}/>
        <rect x="11" y="3" width="2" height="2" fill={c.hair}/>
        {/* angry eyebrows */}
        <line x1="4.5" y1="4" x2="7" y2="4.8" stroke="#5a3018" strokeWidth=".8"/>
        <line x1="11.5" y1="4" x2="9" y2="4.8" stroke="#5a3018" strokeWidth=".8"/>
        {/* eyes */}
        <ellipse cx="6" cy="5.5" rx="1" ry="1.2" fill="#332014"/>
        <ellipse cx="10" cy="5.5" rx="1" ry="1.2" fill="#332014"/>
        <circle cx="6.3" cy="5" r=".4" fill="#fff"/>
        <circle cx="10.3" cy="5" r=".4" fill="#fff"/>
        {/* frown */}
        <path d="M6,8 Q8,7 10,8" stroke="#8d5a3b" strokeWidth=".6" fill="none"/>
        {/* wrinkles */}
        <line x1="3.5" y1="6.5" x2="4.5" y2="6" stroke="#d4a06a" strokeWidth=".3" opacity=".5"/>
        <line x1="12.5" y1="6.5" x2="11.5" y2="6" stroke="#d4a06a" strokeWidth=".3" opacity=".5"/>
      </svg>
    );
  }
  if(c.type==="robot"){
    return (
      <svg width={size} height={size*1.2} viewBox="0 0 16 19" style={{display:"block"}}>
        <ellipse cx="8" cy="18" rx="5" ry="1" fill="#00000033"/>
        {/* body */}
        <rect x="4" y="9" width="8" height="5" rx="1" fill={c.apron||"#ffcc02"}/>
        <rect x="4" y="14" width="3" height="3" fill={c.pants}/>
        <rect x="9" y="14" width="3" height="3" fill={c.pants}/>
        <rect x="5" y="17" width="2" height="1" fill={c.shoes}/>
        <rect x="9" y="17" width="2" height="1" fill={c.shoes}/>
        {/* mechanical arms */}
        <rect x="1" y="10" width="3" height="2" rx=".5" fill={c.body}/>
        <rect x="12" y="10" width="3" height="2" rx=".5" fill={c.body}/>
        <circle cx="2" cy="11" r=".8" fill={c.chest}/>
        <circle cx="14" cy="11" r=".8" fill={c.chest}/>
        {/* boxy head */}
        <rect x="3" y="1" width="10" height="7" rx="1.5" fill={c.body}/>
        <rect x="4" y="2" width="8" height="5" rx="1" fill={c.chest}/>
        {/* antenna */}
        <rect x="7.5" y="-1" width="1" height="2" fill={c.body}/>
        <circle cx="8" cy="-1.5" r="1" fill={c.eye}/>
        {/* binocular eyes */}
        <circle cx="6" cy="4.5" r="2" fill={c.body}/>
        <circle cx="10" cy="4.5" r="2" fill={c.body}/>
        <circle cx="6" cy="4.5" r="1.4" fill={c.eye}/>
        <circle cx="10" cy="4.5" r="1.4" fill={c.eye}/>
        <circle cx="5.5" cy="4" r=".5" fill="#fff"/>
        <circle cx="9.5" cy="4" r=".5" fill="#fff"/>
        {/* happy mouth */}
        <path d="M6.5,6.5 Q8,7.5 9.5,6.5" stroke="#455a64" strokeWidth=".5" fill="none"/>
        {/* chest panel */}
        <rect x="6" y="10" width="4" height="2" rx=".5" fill="#455a64"/>
        <rect x="7" y="10.5" width="2" height="1" rx=".3" fill={c.eye} opacity=".7"/>
      </svg>
    );
  }
  // default human
  return (
    <svg width={size} height={size*1.2} viewBox="0 0 16 19" style={{display:"block"}}>
      <ellipse cx="8" cy="18" rx="5" ry="1" fill="#00000033"/>
      {/* body */}
      <rect x="4" y="9" width="8" height="5" rx="1" fill={c.apron}/>
      <rect x="4" y="14" width="3" height="3" fill={c.pants}/>
      <rect x="9" y="14" width="3" height="3" fill={c.pants}/>
      <rect x="5" y="17" width="2" height="1" fill={c.shoes}/>
      <rect x="9" y="17" width="2" height="1" fill={c.shoes}/>
      {/* arms */}
      <rect x="1" y="10" width="3" height="2" rx=".5" fill={c.skin}/>
      <rect x="12" y="10" width="3" height="2" rx=".5" fill={c.skin}/>
      {/* head */}
      <ellipse cx="8" cy="5.5" rx="4.5" ry="4" fill={c.skin}/>
      {/* chef hat */}
      <rect x="3" y="1" width="10" height="2.5" rx="1" fill={c.hat||"#fff"}/>
      <rect x="5" y="-1" width="6" height="2.5" rx="1" fill={c.hat||"#fff"}/>
      <rect x="6" y="-2" width="4" height="1.5" rx=".8" fill={c.hat||"#fff"}/>
      {/* eyes */}
      <ellipse cx="6" cy="5.5" rx="1" ry="1.2" fill="#332014"/>
      <ellipse cx="10" cy="5.5" rx="1" ry="1.2" fill="#332014"/>
      <circle cx="6.3" cy="5" r=".5" fill="#fff"/>
      <circle cx="10.3" cy="5" r=".5" fill="#fff"/>
      {/* smile */}
      <path d="M6.5,7.5 Q8,8.5 9.5,7.5" stroke="#8d5a3b" strokeWidth=".5" fill="none"/>
      {/* apron tie */}
      <rect x="7" y="10" width="2" height="2" rx=".5" fill="#fff"/>
    </svg>
  );
}

function CharacterSelectGrid({p1Char,p2Char,onSelectP1,onSelectP2,playerCount,isMobile}){
  const screen=useScreen();
  const mobileLandscape=isMobile&&screen.w>screen.h;
  const cols=isMobile?(mobileLandscape?5:3):5;
  const cardSize=isMobile?(mobileLandscape?52:56):56;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:8,alignItems:"center",width:"100%"}}>
      {[0,...(playerCount===2?[1]:[])].map(pid=>(
        <div key={pid} style={{width:"100%"}}>
          <div style={{fontSize:isMobile?12:10,color:pid===0?P.p1:P.p2,fontFamily:"'Silkscreen',monospace",marginBottom:4,textAlign:"center"}}>
            P{pid+1} — {CHARACTERS.find(c=>c.id===(pid===0?p1Char:p2Char))?.name||"?"}
          </div>
          <div style={{display:"grid",gridTemplateColumns:`repeat(${cols}, minmax(0, 1fr))`,gap:isMobile?8:6,justifyContent:"center",maxWidth:isMobile?mobileLandscape?420:340:480,margin:"0 auto"}}>
            {CHARACTERS.map(ch=>{
              const sel=pid===0?(p1Char===ch.id):(p2Char===ch.id);
              const otherSel=pid===0?(p2Char===ch.id):(p1Char===ch.id);
              return (
                <button key={ch.id} onClick={()=>pid===0?onSelectP1(ch.id):onSelectP2(ch.id)} style={{
                  fontFamily:"'Silkscreen',monospace",background:sel?"#2d1b0e":"#1a0f08dd",
                  border:`2px solid ${sel?(pid===0?P.p1:P.p2)+"cc":"#3a2215"}`,
                  borderRadius:12,padding:isMobile?8:6,cursor:"pointer",display:"flex",flexDirection:"column",
                  alignItems:"center",gap:4,opacity:otherSel?.5:1,
                  boxShadow:sel?`0 0 12px ${pid===0?P.p1:P.p2}44`:"none",
                }}>
                  <CharacterPreview char={ch} size={cardSize} selected={sel} pid={pid} />
                  <div style={{fontSize:isMobile?9:7,color:sel?(pid===0?P.p1:P.p2):"#d8b48c",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:cardSize+10}}>{ch.name}</div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function MapMini({mapDef,active=false,compact=false}){
  const screen=useScreen();
  const isMobile=screen.w<900;
  const mobileLandscape=isMobile&&screen.w>screen.h;
  const cell=compact?(isMobile?6:5):(isMobile?(mobileLandscape?6:7):6);
  const fill=(ch)=>{
    if(ch==="W")return "#2d1b0e";
    if(ch==="S")return mapDef.theme?.trim||"#d7b25a";
    if(ch==="C")return "#9d7722";
    if(ch===".")return "#6b4226";
    return mapDef.theme?.accent||"#8fce7e";
  };
  return (
    <div style={{display:"grid",gridTemplateColumns:`repeat(${COLS},${cell}px)`,gap:1,padding:compact?6:8,borderRadius:10,background:active?"#120904":"#1a0f08",border:`1px solid ${active?P.gold+"88":"#3a2215"}`,boxShadow:active?`0 0 18px ${P.gold}22`:"none"}}>
      {mapDef.raw.join("").split("").map((ch,idx)=><div key={idx} style={{width:cell,height:cell,borderRadius:1,background:fill(ch),opacity:ch==="." ? 0.82 : 1}}/>)}
    </div>
  );
}

function MapChoiceGrid({selected,onSelect,isMobile,compact=false}){
  const screen=useScreen();
  const mobileLandscape=isMobile&&screen.w>screen.h;
  const mapCount=Object.keys(MAPS).length;
  const cols=isMobile?(mobileLandscape?3:2):(compact?4:4);
  const cell=compact?(isMobile?5:4):(isMobile?(mobileLandscape?5:5):5);
  const cardWidth=isMobile?(mobileLandscape?undefined:undefined):(compact?148:156);
  return (
    <div style={{display:"grid",gridTemplateColumns:`repeat(${cols}, minmax(0, 1fr))`,gap:isMobile?10:8,justifyContent:"center",width:"100%",maxWidth:isMobile?mobileLandscape?800:420:720}}>
      {Object.entries(MAPS).map(([key,mapDef])=>{
        const active=selected===key;
        return (
          <button key={key} onClick={()=>onSelect(key)} style={{fontFamily:"'Silkscreen',monospace",background:active?"#2d1b0e":"#1a0f08dd",border:`2px solid ${active?P.gold+"aa":"#4a2a18"}`,borderRadius:isMobile?18:14,padding:compact?(isMobile?12:10):(isMobile?14:12),width:cardWidth||"100%",minWidth:0,cursor:"pointer",display:"flex",flexDirection:"column",gap:isMobile?10:8,alignItems:"center",justifySelf:"center",boxShadow:active?"0 10px 24px #00000044":"none"}}>
            <MapLogo deco={mapDef.theme?.deco||key} size={isMobile?(compact?36:44):(compact?32:40)} />
            <div style={{fontSize:isMobile?(compact?12:14):(compact?10:10),color:active?P.gold:"#f5e6d3"}}>{mapDef.name}</div>
            <div style={{transform:isMobile&&!compact?"scale(1.04)":"none",transformOrigin:"center top"}}>
              <MapMini mapDef={mapDef} active={active} compact={compact||mobileLandscape} />
            </div>
            <div style={{fontSize:isMobile?(compact?10:11):8,color:active?"#d8b48c":"#8a6a4a",lineHeight:isMobile?1.85:1.7,maxWidth:isMobile?240:160,textAlign:"center"}}>{mapDef.desc}</div>
          </button>
        );
      })}
    </div>
  );
}

function InstallHelpModal({appShell}){
  if(!appShell?.installHelpOpen)return null;
  const isIos=appShell.isIos;
  return (
    <div style={{position:"absolute",inset:0,zIndex:30,background:"#00000088",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{maxWidth:420,width:"100%",background:"#1a0f08f2",border:`2px solid ${P.gold}55`,borderRadius:22,padding:"20px 18px",display:"flex",flexDirection:"column",gap:12,fontFamily:"'Silkscreen',monospace",color:"#f5e6d3",boxShadow:"0 24px 50px #00000055"}}>
        <div style={{fontSize:18,color:P.gold,textAlign:"center"}}>INSTALL CAFE CHAOS</div>
        <div style={{fontSize:10,lineHeight:1.8,color:"#d8b48c"}}>
          {isIos?"For iPhone and iPad, the clean full-screen experience comes from adding the game to your Home Screen. Safari tabs cannot hide their browser chrome the same way.":"Install the game from your browser for the cleanest full-screen app experience and faster relaunches."}
        </div>
        {isIos&&<div style={{fontSize:9,lineHeight:1.9,color:"#f5e6d3"}}>
          1. Tap the Share button in Safari.
          <br />
          2. Choose Add to Home Screen.
          <br />
          3. Launch Cafe Chaos from the new home-screen icon.
        </div>}
        {!isIos&&<div style={{fontSize:9,lineHeight:1.9,color:"#f5e6d3"}}>
          Use the browser install prompt or menu option to install the app, then reopen it from your desktop or home screen.
        </div>}
        <div style={{display:"flex",justifyContent:"center"}}>
          <button onClick={appShell.closeInstallHelp} style={{fontFamily:"'Silkscreen',monospace",fontWeight:"bold",fontSize:10,padding:"10px 18px",borderRadius:999,border:"1px solid #6b3a1f88",background:"#2d1b0e",color:"#f5e6d3",cursor:"pointer"}}>CLOSE</button>
        </div>
      </div>
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// GAME
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function Game({playerCount,diff,mapKey,charIds,onEnd,isMobile,onlineSession,appShell,audioUi,tutorialTrack,onTutorialExit,onTutorialComplete}){
  const canvasRef=useRef(null);const gs=useRef(null);const keys=useRef(new Set());
  const frame=useRef(0);const lastMove=useRef({0:0,1:0});
  const[hud,setHud]=useState({score:0,time:DIFF[diff].time,combo:0,flow:0,rushLeft:0,freezeLeft:0,orders:[],holding:[null,null]});
  const[mobileQueueOpen,setMobileQueueOpen]=useState(false);
  const[mobileUtilityOpen,setMobileUtilityOpen]=useState(false);
  const[tutorialStepIdx,setTutorialStepIdx]=useState(0);
  const[coachOpen,setCoachOpen]=useState(true);
  const[coachMsg,setCoachMsg]=useState("");
  const[coachMsgType,setCoachMsgType]=useState("step");
  const[coachTip,setCoachTip]=useState("");
  const parts=useRef(new Particles());const screen=useScreen();
  const online = !!onlineSession;
  const isHost = !online || onlineSession.role === "host";
  const localPid = online ? onlineSession.playerId : 0;
  const hasShellActions = !!(appShell?.showInstallAction || appShell?.showFullscreenAction);
  const remoteInputs=useRef([]);
  const autoTasks=useRef({0:null,1:null});
  const mobileTapHighlight=useRef(null);
  const tutorialStepRef=useRef(0);
  const lastSnapshot=useRef(0);
  const endedRemotely=useRef(false);
  const tutorialMode=!!tutorialTrack;
  const tutorialLesson=tutorialTrack?TRAINING_TRACKS[tutorialTrack]:null;
  const tutorialStep=tutorialLesson?.steps[tutorialStepIdx]||null;

  // Movement buffer: store pending direction per player
  const moveBuffer=useRef({0:null,1:null});

  const computeT = useCallback(() => {
    if (isMobile) {
      const landscape = screen.w >= screen.h;
      const reservedH = landscape ? 92 : 190;
      const byWidth = Math.floor((screen.w - (landscape ? 8 : 20)) / COLS);
      const byHeight = Math.floor((screen.h - reservedH) / ROWS);
      return Math.max(20, Math.min(byWidth, byHeight, landscape ? 50 : 56));
    }
    return Math.min(Math.floor((screen.w - 40) / COLS), Math.floor((screen.h - 200) / ROWS), 56);
  }, [isMobile, screen]);
  const T = computeT();
  const BW = COLS * T, BH = ROWS * T;

  useEffect(()=>{
    tutorialStepRef.current=0;
    setTutorialStepIdx(0);
  },[tutorialTrack]);

  const addPop=useCallback((text,x,y,type="good")=>{if(gs.current)gs.current.popups.push({text,x,y,type,life:60,ml:60});},[]);

  const applyTutorialStepState=useCallback((g,stepIndex)=>{
    if(!tutorialLesson)return;
    const step=tutorialLesson.steps[stepIndex];
    if(!step)return;
    Object.keys(g.counters).forEach((key)=>{g.counters[key]=null;});
    const mapDef=getActiveMapDef();
    g.players.forEach((player,idx)=>{
      const spawn=mapDef.spawns[idx]||mapDef.spawns[0]||[4,6];
      player.r=spawn[0];
      player.c=spawn[1];
      player.vr=spawn[0];
      player.vc=spawn[1];
      player.dir="down";
      player.holding=null;
      player.processing=null;
      player.af=0;
      player.squash={sx:1,sy:1,t:0};
    });
    autoTasks.current={0:null,1:null};
    mobileTapHighlight.current=null;
    g.orders=[mkTutorialOrder(step.drink,stepIndex)];
    g.combo=0;
    g.comboT=0;
    g.flow=0;
    g.nextOrd=9999;
    g.timeLeft=Math.max(g.timeLeft,599);
  },[tutorialLesson]);

  const completeTutorialStep=useCallback((servedDrink,g)=>{
    if(!tutorialLesson)return false;
    const idx=tutorialStepRef.current;
    const step=tutorialLesson.steps[idx];
    if(!step||step.drink!==servedDrink)return false;
    const congrats=CAT_CONGRATS[Math.floor(Math.random()*CAT_CONGRATS.length)];
    setCoachMsg(congrats);setCoachTip("");setCoachMsgType("congrats");setCoachOpen(true);
    if(idx>=tutorialLesson.steps.length-1){
      g.orders=[];
      g.over=true;
      setHud(toHudState(g));
      setTimeout(()=>onTutorialComplete?.(tutorialLesson.id),450);
      return true;
    }
    const nextIdx=idx+1;
    tutorialStepRef.current=nextIdx;
    setTutorialStepIdx(nextIdx);
    applyTutorialStepState(g,nextIdx);
    addPop("NEXT DRINK",BW/2,T*.95,"combo");
    setHud(toHudState(g));
    setTimeout(()=>{
      const ns=tutorialLesson.steps[nextIdx];
      if(ns){setCoachMsg(ns.mentor);setCoachTip(ns.tip||"");setCoachMsgType("step");setCoachOpen(true);}
    },2800);
    return true;
  },[tutorialLesson,applyTutorialStepState,addPop,BW,T,onTutorialComplete]);

  useEffect(()=>{
    gs.current=createGameState(playerCount,diff,mapKey,charIds||[]);
    if(tutorialMode&&tutorialLesson){
      tutorialStepRef.current=0;
      applyTutorialStepState(gs.current,0);
      const firstStep=tutorialLesson.steps[0];
      if(firstStep){setCoachMsg(firstStep.mentor);setCoachTip(firstStep.tip||"");setCoachMsgType("step");setCoachOpen(true);}
    }
    setHud(toHudState(gs.current));
    frame.current=0;
    lastMove.current={0:0,1:0};
    moveBuffer.current={0:null,1:null};
    remoteInputs.current=[];
    autoTasks.current={0:null,1:null};
    mobileTapHighlight.current=null;
    lastSnapshot.current=0;
    endedRemotely.current=false;
    parts.current=new Particles();
  },[playerCount,diff,mapKey,tutorialMode,tutorialLesson,applyTutorialStepState]);

  useEffect(()=>{
    sfx.setMusicRate(hud.rushLeft>0?1.16:1);
    return ()=>sfx.setMusicRate(1);
  },[hud.rushLeft]);

  useEffect(()=>{
    if(!mobileQueueOpen)return;
    const timer=setTimeout(()=>setMobileQueueOpen(false),4200);
    return ()=>clearTimeout(timer);
  },[mobileQueueOpen,hud.orders.length]);

  useEffect(()=>{
    setMobileQueueOpen(false);
    setMobileUtilityOpen(false);
  },[playerCount,diff,mapKey,onlineSession]);

  const tryMove=useCallback((pid,dir)=>{
    const g=gs.current;if(!g||g.over)return;
    const p=g.players.find(pl=>pl.id===pid);if(!p)return;
    p.dir=dir;
    const now=Date.now();
    const moveDelay=now<(g.rushEnd||0)?POWER_RULES.rushMoveDelay:140;
    if(now-lastMove.current[pid]<moveDelay)return false; // Rush shaves the step cooldown for a quick power sprint
    const[dr,dc]=DIRS[dir];const nr=p.r+dr,nc=p.c+dc;
    if(isFloor(nr,nc)&&!g.players.some(op=>op.id!==pid&&op.r===nr&&op.c===nc)){
      p.r=nr;p.c=nc;p.af++;lastMove.current[pid]=now;
      // Squash & stretch
      if(dir==="up"||dir==="down"){p.squash={sx:0.8,sy:1.2,t:8};}
      else{p.squash={sx:1.2,sy:0.8,t:8};}
      // Dust particles
      parts.current.emit(p.vc*T+T/2,p.vr*T+T/2,"dust",3);
      if(now<(g.rushEnd||0))parts.current.emit(p.vc*T+T/2,p.vr*T+T/2,"serve",1);
      if(p.af%2===0)sfx.play("step");
      return true;
    }
    return false;
  },[T]);

  const clearAutoTask=useCallback((pid)=>{autoTasks.current[pid]=null;},[]);

  const planAutoTask=useCallback((pid,r,c)=>{
    const g=gs.current;if(!g||g.over)return null;
    const player=g.players.find((pl)=>pl.id===pid);if(!player)return null;
    if(r<0||r>=ROWS||c<0||c>=COLS)return null;
    const cell=MAP[r][c];if(!cell)return null;
    const occupied=new Set(g.players.filter((pl)=>pl.id!==pid).map((pl)=>cellKey(pl.r,pl.c)));
    const blocked=(nr,nc)=>!isFloor(nr,nc)||(occupied.has(cellKey(nr,nc))&&!(nr===player.r&&nc===player.c));

    if(cell.type==="floor"){
      const path=findPath({r:player.r,c:player.c},(nr,nc)=>nr===r&&nc===c,blocked);
      if(!path||!path.length)return null;
      return {type:"move",target:{r,c},path:[...path]};
    }

    if(cell.type==="counter"||cell.type==="station"){
      let best=null;
      for(const [dir,[dr,dc]] of Object.entries(DIRS)){
        const ar=r-dr,ac=c-dc;
        if(blocked(ar,ac)&&!(ar===player.r&&ac===player.c))continue;
        const path=findPath({r:player.r,c:player.c},(nr,nc)=>nr===ar&&nc===ac,blocked);
        if(path===null)continue;
        if(!best||path.length<best.path.length){
          best={type:"interact",target:{r,c},path:[...path],finalDir:dir,autoAction:true};
        }
      }
      return best;
    }

    return null;
  },[]);

  const setAutoTarget=useCallback((pid,r,c)=>{
    const next=planAutoTask(pid,r,c);
    autoTasks.current[pid]=next;
    return !!next;
  },[planAutoTask]);

  const usePower=useCallback((kind)=>{
    const g=gs.current;if(!g||g.over)return false;
    const now=Date.now();
    if(kind==="rush"){
      if(now<(g.rushEnd||0)||(g.flow||0)<POWER_RULES.rushCost)return false;
      g.flow=Math.max(0,(g.flow||0)-POWER_RULES.rushCost);
      g.rushEnd=now+POWER_RULES.rushMs;
      g.shake.mag=Math.max(g.shake.mag,5);
      sfx.play("combo");haptic("heavy");
      addPop("RUSH!",BW/2,T*1.2,"combo");
      for(const player of g.players)parts.current.emit(player.c*T+T/2,player.r*T+T/2,"serve",8);
      setHud(toHudState(g));
      return true;
    }
    if(kind==="freeze"){
      if(now<(g.freezeEnd||0)||(g.flow||0)<POWER_RULES.freezeCost)return false;
      g.flow=Math.max(0,(g.flow||0)-POWER_RULES.freezeCost);
      g.freezeEnd=now+POWER_RULES.freezeMs;
      g.shake.mag=Math.max(g.shake.mag,4);
      sfx.play("done");haptic("heavy");
      addPop("TIME STOP!",BW/2,T*1.2,"combo");
      parts.current.emit(BW/2,T*.55,"steam",18);
      setHud(toHudState(g));
      return true;
    }
    return false;
  },[addPop,BW,T]);

  const doAction=useCallback((pid)=>{
    const g=gs.current;if(!g||g.over)return;
    const p=g.players.find(pl=>pl.id===pid);if(!p)return;
    sfx.init();
    if(p.processing)return;
    const[dr,dc]=DIRS[p.dir];const tr=p.r+dr,tc=p.c+dc;
    const ck=`${tr},${tc}`;
    if(g.counters.hasOwnProperty(ck)){
      if(p.holding&&!g.counters[ck]){g.counters[ck]=p.holding;p.holding=null;sfx.play("putdown");haptic("light");parts.current.emit(tc*T+T/2,tr*T+T/2,"steam",4);return;}
      else if(!p.holding&&g.counters[ck]){p.holding=g.counters[ck];g.counters[ck]=null;sfx.play("pickup");haptic("light");return;}
    }
    if(tr<0||tr>=ROWS||tc<0||tc>=COLS)return;
    const cell=MAP[tr][tc];if(cell.type!=="station")return;
    if(cell.station==="serve"){
      if(!p.holding||!p.holding.ingredients?.length)return;
      const dn=matchRecipe(p.holding.ingredients);
      if(!dn){
        sfx.play("fail");haptic("heavy");parts.current.emit(tc*T+T/2,tr*T+T/2,"fail",6);
        if(tutorialMode){addPop("Check the coach card",tc*T+T/2,tr*T,"bad");setHud(toHudState(g));return;}
        g.combo=0;g.flow=Math.max(0,(g.flow||0)-POWER_RULES.failPenalty);g.timeLeft=Math.max(0,g.timeLeft-TIMER_RULES.failPenalty);addPop(`Wrong! -${TIMER_RULES.failPenalty}s`,tc*T+T/2,tr*T,"bad");setHud(toHudState(g));return;
      }
      const oi=g.orders.findIndex(o=>o.drink===dn);
      if(oi===-1){
        sfx.play("fail");haptic("heavy");parts.current.emit(tc*T+T/2,tr*T+T/2,"fail",6);
        if(tutorialMode){addPop("Not the lesson drink",tc*T+T/2,tr*T,"bad");setHud(toHudState(g));return;}
        g.combo=0;g.flow=Math.max(0,(g.flow||0)-POWER_RULES.failPenalty);g.timeLeft=Math.max(0,g.timeLeft-TIMER_RULES.failPenalty);addPop(`No order! -${TIMER_RULES.failPenalty}s`,tc*T+T/2,tr*T,"bad");setHud(toHudState(g));return;
      }
      const ord=g.orders[oi];const tb=Math.max(0,~~((1-ord.elapsed/ord.patience)*15));
      const pts=RECIPES[dn].pts+tb;
      if(tutorialMode){
        g.score+=pts;
        g.orders.splice(oi,1);
        p.holding=null;
        g.shake.mag=5;
        sfx.play("serve");haptic("medium");
        addPop(tutorialStepRef.current>=tutorialLesson.steps.length-1?"TRAINING CLEAR":"STEP CLEAR",tc*T+T/2,tr*T-8,"combo");
        parts.current.emit(tc*T+T/2,tr*T+T/2,"serve",14);
        setHud(toHudState(g));
        completeTutorialStep(dn,g);
        return;
      }
      g.combo++;g.comboT=180;
      const flowGain=flowGainForCombo(g.combo);
      const timeGain=timeGainForServe(ord,g.combo,diff);
      g.flow=clamp((g.flow||0)+flowGain,0,POWER_RULES.maxFlow);
      g.timeLeft+=timeGain;
      g.score+=pts*(g.combo>=3?2:1);g.orders.splice(oi,1);p.holding=null;g.shake.mag=6;
      if(g.combo>=3){sfx.play("combo");haptic("heavy");addPop(`x${g.combo}! +${pts*2}`,tc*T+T/2,tr*T-10,"combo");parts.current.emit(tc*T+T/2,tr*T+T/2,"combo",20);}
      else{sfx.play("serve");haptic("medium");addPop(`+${pts}`,tc*T+T/2,tr*T,"good");parts.current.emit(tc*T+T/2,tr*T+T/2,"serve",12);}
      addPop(`+${timeGain}s`,tc*T+T/2,tr*T-22,g.combo>=3?"combo":"good");
      setHud(toHudState(g));
      return;
    }
    const st=STATIONS[cell.station];if(!st)return;
    if(st.action==="give_cup"){if(!p.holding){p.holding={type:"cup",ingredients:[]};sfx.play("pickup");haptic("light");}return;}
    if(st.action==="trash"){if(p.holding){p.holding=null;p.processing=null;sfx.play("trash");haptic("medium");parts.current.emit(tc*T+T/2,tr*T+T/2,"trash",8);}return;}
    if(st.adds){
      if(!p.holding||p.holding.type!=="cup")return;
      if(p.holding.ingredients.includes(st.adds)){addPop("Added!",tc*T+T/2,tr*T,"bad");sfx.play("fail");return;}
      if(p.holding.ingredients.length>=5)return;
      if(st.time){p.processing={ingredient:st.adds,end:Date.now()+st.time,dur:st.time,st:{r:tr,c:tc}};sfx.play("process");return;}
      p.holding.ingredients.push(st.adds);sfx.play("add");haptic("light");parts.current.emit(tc*T+T/2,tr*T+T/2,"steam",3);
    }
  },[addPop,T,tutorialMode,tutorialLesson,completeTutorialStep]);

  const advanceAutoTask=useCallback((pid)=>{
    const task=autoTasks.current[pid];
    if(!task)return;

    if(task.path.length){
      const moved=tryMove(pid,task.path[0]);
      if(moved){task.path.shift();}
      else{
        autoTasks.current[pid]=planAutoTask(pid,task.target.r,task.target.c);
        return;
      }
    }

    if(!task.path.length){
      const g=gs.current;
      const player=g?.players.find((pl)=>pl.id===pid);
      if(player&&task.finalDir)player.dir=task.finalDir;
      if(task.autoAction)doAction(pid);
      autoTasks.current[pid]=null;
    }
  },[tryMove,planAutoTask,doAction]);

  useEffect(()=>{
    if(!onlineSession)return;
    if(isHost){
      onlineSession.setHandlers({
        onInput:(payload)=>{
          if(payload?.playerId===1)remoteInputs.current.push(payload);
        },
      });
    }else{
      onlineSession.setHandlers({
        onSnapshot:(payload)=>{
          if(!payload?.state)return;
          const next=reviveGameState(payload.state);
          gs.current=next;
          setHud(toHudState(next));
        },
        onGameOver:(payload)=>{
          if(endedRemotely.current)return;
          endedRemotely.current=true;
          onEnd(payload?.score ?? gs.current?.score ?? 0);
        },
      });
    }
    return ()=>onlineSession.setHandlers({});
  },[onlineSession,isHost,onEnd]);

  const sendOnlineInput=useCallback((payload)=>{
    if(!onlineSession)return;
    onlineSession.sendInput({ ...payload, playerId:localPid }).catch(()=>{});
  },[onlineSession,localPid]);

  const handleMoveInput=useCallback((pid,dir)=>{
    if(online&&pid!==localPid)return false;
    clearAutoTask(pid);
    if(online&&!isHost){sendOnlineInput({type:"move",dir});return true;}
    return tryMove(pid,dir);
  },[online,localPid,isHost,sendOnlineInput,tryMove,clearAutoTask]);

  const handleActionInput=useCallback((pid)=>{
    if(online&&pid!==localPid)return;
    clearAutoTask(pid);
    if(online&&!isHost){sfx.init();sendOnlineInput({type:"action"});return;}
    doAction(pid);
  },[online,localPid,isHost,sendOnlineInput,doAction,clearAutoTask]);

  const handlePowerInput=useCallback((kind)=>{
    sfx.init();
    if(online&&!isHost){sendOnlineInput({type:"power",power:kind});return;}
    usePower(kind);
  },[online,isHost,sendOnlineInput,usePower]);

  // Keyboard
  useEffect(()=>{
    if(isMobile)return;
    const K1={KeyW:"up",KeyS:"down",KeyA:"left",KeyD:"right"};
    const K2={ArrowUp:"up",ArrowDown:"down",ArrowLeft:"left",ArrowRight:"right"};
    const dn=e=>{
      if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space","Slash"].includes(e.code))e.preventDefault();
      if(e.code==="KeyQ"){e.preventDefault();handlePowerInput("rush");return;}
      if(e.code==="KeyR"){e.preventDefault();handlePowerInput("freeze");return;}
      keys.current.add(e.code);
      if(online){
        const isP1Action=e.code==="KeyE"||e.code==="Space";
        const isP2Action=e.code==="Slash"||e.code==="Numpad0";
        if((localPid===0&&isP1Action)||(localPid===1&&isP2Action)){sfx.init();handleActionInput(localPid);}
        if(localPid===0&&K1[e.code])moveBuffer.current[0]=K1[e.code];
        if(localPid===1&&K2[e.code])moveBuffer.current[1]=K2[e.code];
        return;
      }
      if(e.code==="KeyE"||e.code==="Space"){sfx.init();handleActionInput(0);}
      if(playerCount>=2&&(e.code==="Slash"||e.code==="Numpad0")){sfx.init();handleActionInput(1);}
      // Buffer direction for immediate first step
      if(K1[e.code])moveBuffer.current[0]=K1[e.code];
      if(playerCount>=2&&K2[e.code])moveBuffer.current[1]=K2[e.code];
    };
    const up=e=>keys.current.delete(e.code);
    window.addEventListener("keydown",dn);window.addEventListener("keyup",up);
    return ()=>{window.removeEventListener("keydown",dn);window.removeEventListener("keyup",up);};
  },[handleActionInput,handlePowerInput,playerCount,isMobile,online,localPid]);

  // Continuous movement from held keys â€” faster tick
  useEffect(()=>{
    if(isMobile)return;
    const K1={KeyW:"up",KeyS:"down",KeyA:"left",KeyD:"right"};
    const K2={ArrowUp:"up",ArrowDown:"down",ArrowLeft:"left",ArrowRight:"right"};
    const iv=setInterval(()=>{
      // Process buffered moves first
      for(const pid of[0,1]){
        if(moveBuffer.current[pid]){handleMoveInput(pid,moveBuffer.current[pid]);moveBuffer.current[pid]=null;}
      }
      for(const code of keys.current){
        if(online){
          if(localPid===0&&K1[code])handleMoveInput(0,K1[code]);
          if(localPid===1&&K2[code])handleMoveInput(1,K2[code]);
        }else{
          if(K1[code])handleMoveInput(0,K1[code]);
          if(playerCount>=2&&K2[code])handleMoveInput(1,K2[code]);
        }
      }
    },100); // Keyboard repeat tick
    return ()=>clearInterval(iv);
  },[handleMoveInput,playerCount,isMobile,online,localPid]);

  useEffect(()=>{
    const iv=setInterval(()=>{
      if(!online||isHost){
        const autoPlayers=online?[0,1]:playerCount===2?[0,1]:[0];
        for(const pid of autoPlayers)advanceAutoTask(pid);
      }
    },100);
    return ()=>clearInterval(iv);
  },[online,isHost,playerCount,advanceAutoTask]);

  // Game loop
  useEffect(()=>{
    let run=true,lastSec=Date.now();const d=DIFF[diff];
    const loop=()=>{
      if(!run)return;const g=gs.current;if(!g||g.over){requestAnimationFrame(loop);return;}
      const f=frame.current++;

      if(isHost){
        if(online&&remoteInputs.current.length){
          const queued=remoteInputs.current.splice(0,remoteInputs.current.length);
          for(const input of queued){
            if(input?.type==="move"&&input.dir){clearAutoTask(1);tryMove(1,input.dir);}
            if(input?.type==="action"){clearAutoTask(1);doAction(1);}
            if(input?.type==="target"&&Number.isInteger(input.r)&&Number.isInteger(input.c))setAutoTarget(1,input.r,input.c);
            if(input?.type==="power"&&input.power)usePower(input.power);
          }
        }

      const now=Date.now();
      if(now-lastSec>=1000){
        lastSec=now;g.elapsed++;
        g.comboT=Math.max(0,g.comboT-60);if(g.comboT<=0)g.combo=0;
        if(!tutorialMode){
          g.timeLeft--;
          if(g.timeLeft<=10&&g.timeLeft>0)sfx.play("tick");
          const freezeActive=now<(g.freezeEnd||0);
          if(!freezeActive){
            g.nextOrd--;
            if(g.nextOrd<=0&&g.orders.length<6){
              g.orders.push(mkOrder(g.elapsed,diff));
              g.nextOrd=Math.max(d.spawnMin,d.spawnBase-~~(g.elapsed/30))+~~(Math.random()*4);
              sfx.play("neworder");
            }
            g.orders=g.orders.map(o=>({...o,elapsed:o.elapsed+1}));
            const exp=g.orders.filter(o=>o.elapsed>=o.patience);
            if(exp.length){
              const timeLoss=(TIMER_RULES.missPenalty[diff]??9)*exp.length;
              g.combo=0;
              g.flow=Math.max(0,(g.flow||0)-POWER_RULES.missPenalty*exp.length);
              g.timeLeft=Math.max(0,g.timeLeft-timeLoss);
              sfx.play("warn");
              addPop(`${exp.length>1?"ORDERS LOST":"ORDER LOST"} -${timeLoss}s`,BW/2,T*.95,"bad");
              setHud(toHudState(g));
            }
            g.orders=g.orders.filter(o=>o.elapsed<o.patience);
          }
        }
        if(!tutorialMode&&g.timeLeft<=0){g.over=true;if(onlineSession)onlineSession.sendGameOver({score:g.score,diff}).catch(()=>{});onEnd(g.score);return;}
        setHud(toHudState(g));
      }

      for(const p of g.players){
        if(p.processing){
          const rem=p.processing.end-Date.now();
          if(rem<=0){p.holding.ingredients.push(p.processing.ingredient);sfx.play("done");haptic("medium");parts.current.emit(p.processing.st.c*T+T/2,p.processing.st.r*T+T/4,"steam",6);p.processing=null;}
          else if(f%22===0)parts.current.emit(p.processing.st.c*T+T/2+(Math.random()-.5)*10,p.processing.st.r*T+T/4,"steam",1);
        }
        // Smooth visual lerp â€” not too fast so you see the slide
        p.vr+=(p.r-p.vr)*.22;p.vc+=(p.c-p.vc)*.22;
        // Snap when close
        if(Math.abs(p.r-p.vr)<.03)p.vr=p.r;
        if(Math.abs(p.c-p.vc)<.03)p.vc=p.c;
        // Squash decay
        if(p.squash.t>0){p.squash.t--;
          const t=p.squash.t/8;
          p.squash.sx=1+(p.squash.sx-1)*t;
          p.squash.sy=1+(p.squash.sy-1)*t;
        }else{p.squash.sx=1;p.squash.sy=1;}
      }

      if((g.rushEnd||0)>now&&f%9===0){
        for(const player of g.players)parts.current.emit(player.c*T+T/2,player.r*T+T/2,"serve",1);
      }
      if((g.freezeEnd||0)>now&&f%20===0){
        parts.current.emit(BW/2,T*.58,"steam",1);
      }

      if(g.shake.mag>0){g.shake.x=(Math.random()-.5)*g.shake.mag;g.shake.y=(Math.random()-.5)*g.shake.mag;g.shake.mag*=.85;if(g.shake.mag<.5)g.shake.mag=0;}
      g.popups=g.popups.filter(pp=>{pp.life--;pp.y-=.6;return pp.life>0;});
      parts.current.update();
      if(online&&Date.now()-lastSnapshot.current>=80){
        lastSnapshot.current=Date.now();
        onlineSession.sendSnapshot({state:serializeGameState(g)}).catch(()=>{});
      }
      }else{
        for(const p of g.players){
          p.vr+=(p.r-p.vr)*.22;p.vc+=(p.c-p.vc)*.22;
          if(Math.abs(p.r-p.vr)<.03)p.vr=p.r;
          if(Math.abs(p.c-p.vc)<.03)p.vc=p.c;
          if(p.squash?.t>0){p.squash.t--;
            const t=p.squash.t/8;
            p.squash.sx=1+(p.squash.sx-1)*t;
            p.squash.sy=1+(p.squash.sy-1)*t;
          }else if(p.squash){p.squash.sx=1;p.squash.sy=1;}
        }
        parts.current.update();
        if(mobileTapHighlight.current){
          mobileTapHighlight.current.life-=1;
          if(mobileTapHighlight.current.life<=0)mobileTapHighlight.current=null;
        }
      }

      // RENDER
      const cv=canvasRef.current;if(!cv){requestAnimationFrame(loop);return;}
      const ctx=cv.getContext("2d");ctx.imageSmoothingEnabled=false;
      ctx.save();ctx.translate(g.shake.x,g.shake.y);
      ctx.fillStyle=P.bg;ctx.fillRect(-10,-10,BW+20,BH+20);
      drawCafeDecor(ctx,T,BW,BH,f);
      const mapTheme=getActiveMapDef().theme||{};

      for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
        const cell=MAP[r][c],x=c*T,y=r*T;
        if(cell.type==="floor"){
          if(mapTheme.deco==="sunbooks")drawSunbooksFloor(ctx,x,y,T,r,c);
          else if(mapTheme.deco==="catcafe")drawCatCafeFloor(ctx,x,y,T,r,c);
          else if(mapTheme.deco==="centralperks")drawCentralPerksFloor(ctx,x,y,T,r,c);
          else if(mapTheme.deco==="halloween")drawHalloweenFloor(ctx,x,y,T,r,c);
          else if(mapTheme.deco==="winter")drawWinterFloor(ctx,x,y,T,r,c);
          else if(mapTheme.deco==="eid")drawEidFloor(ctx,x,y,T,r,c);
          else{ctx.fillStyle=(r+c)%2===0?P.floor1:P.floor2;ctx.fillRect(x,y,T,T);ctx.fillStyle=P.floor3+"18";ctx.fillRect(x,y,T,1);ctx.fillRect(x,y,1,T);}
        }
        else if(cell.type==="wall"){
          if(mapTheme.deco==="sunbooks")drawSunbooksWall(ctx,x,y,T,r,c);
          else if(mapTheme.deco==="catcafe")drawCatCafeWall(ctx,x,y,T,r,c);
          else if(mapTheme.deco==="centralperks")drawCentralPerksWall(ctx,x,y,T,r,c,f);
          else if(mapTheme.deco==="halloween")drawHalloweenWall(ctx,x,y,T,r,c,f);
          else if(mapTheme.deco==="winter")drawWinterWall(ctx,x,y,T,r,c,f);
          else if(mapTheme.deco==="eid")drawEidWall(ctx,x,y,T,r,c,f);
          else{ctx.fillStyle=P.wall;ctx.fillRect(x,y,T,T);const bh=T/4;for(let by=0;by<4;by++){const off=by%2===0?0:T/2;ctx.fillStyle=P.wallLine+"30";ctx.fillRect(x,y+by*bh,T,1);ctx.fillRect(x+off,y+by*bh,1,bh);ctx.fillRect(x+off+T/2,y+by*bh,1,bh);}}
        }
        else if(cell.type==="counter"){
          const it=g.counters[`${r},${c}`];
          if(mapTheme.deco==="sunbooks")drawSunbooksCounter(ctx,x,y,T,it,f);
          else if(mapTheme.deco==="catcafe")drawCatCafeCounter(ctx,x,y,T,it,f);
          else if(mapTheme.deco==="centralperks")drawCentralPerksCounter(ctx,x,y,T,it,f);
          else if(mapTheme.deco==="halloween")drawHalloweenCounter(ctx,x,y,T,it,f);
          else if(mapTheme.deco==="winter")drawWinterCounter(ctx,x,y,T,it,f);
          else if(mapTheme.deco==="eid")drawEidCounter(ctx,x,y,T,it,f);
          else{ctx.fillStyle=(r+c)%2===0?P.floor1:P.floor2;ctx.fillRect(x,y,T,T);ctx.fillStyle=P.counter;ctx.fillRect(x+3,y+3,T-6,T-6);ctx.fillStyle=P.counterTop;ctx.fillRect(x+3,y+3,T-6,5);ctx.fillStyle=P.counterEdge;ctx.fillRect(x+3,y+T-8,T-6,4);if(it)drawCup(ctx,x+T/2-8,y+T/2-10,16,it.ingredients||[]);}
        }
        else if(cell.type==="station"){
          if(cell.station==="serve"&&mapTheme.deco==="sunbooks")drawSunbooksServe(ctx,x,y,T,f);
          else if(cell.station==="serve"&&mapTheme.deco==="catcafe")drawCatCafeServe(ctx,x,y,T,f);
          else if(cell.station==="serve"&&mapTheme.deco==="centralperks")drawCentralPerksServe(ctx,x,y,T,f);
          else if(cell.station==="serve"&&mapTheme.deco==="halloween")drawHalloweenServe(ctx,x,y,T,f);
          else if(cell.station==="serve"&&mapTheme.deco==="winter")drawWinterServe(ctx,x,y,T,f);
          else if(cell.station==="serve"&&mapTheme.deco==="eid")drawEidServe(ctx,x,y,T,f);
          else if(cell.station==="serve")drawServe(ctx,x,y,T,f);
          else drawSt(ctx,x,y,T,cell.station,f);
        }
      }
      // tutorial station highlights
      if(tutorialMode){
        const tp=g.players[0];
        const tStep=tutorialLesson?.steps[tutorialStepRef.current];
        if(tStep){
          const tRecipe=RECIPES[tStep.drink];
          const tHeld=tp.holding;
          const tHeldIngs=tHeld?.ingredients||[];
          let tTargets=[];let tColor="#ffe066";
          if(!tHeld){
            tTargets=["U"];tColor="#ffe066";
          }else if(tRecipe){
            const tNeeded=tRecipe.ing.filter(ing=>!tHeldIngs.includes(ing));
            if(tNeeded.length===0){
              tTargets=["_serve"];tColor="#4caf50";
            }else{
              tTargets=tNeeded.map(ing=>ING_TO_STATION[ing]).filter(Boolean);
              tColor="#ffe066";
            }
          }
          let tNum=1;
          for(let tr=0;tr<ROWS;tr++)for(let tc=0;tc<COLS;tc++){
            const tCell=MAP[tr][tc];
            if(tCell.type!=="station")continue;
            const isServeTarget=tCell.station==="serve"&&tTargets.includes("_serve");
            const isStTarget=tTargets.includes(tCell.station);
            if(isServeTarget||isStTarget){
              drawTutorialHighlight(ctx,tc*T,tr*T,T,f,tColor,tTargets.length<=3?tNum:undefined);
              tNum++;
            }
          }
        }
      }
      drawTapTargetMarker(ctx,T,mobileTapHighlight.current,f);
      if(mapTheme.deco==="catcafe")drawCatCafeAmbient(ctx,T,BW,BH,f);
      if(mapTheme.deco==="halloween")drawHalloweenAmbient(ctx,T,BW,BH,f);
      if(mapTheme.deco==="winter")drawWinterAmbient(ctx,T,BW,BH,f);
      if(mapTheme.deco==="eid")drawEidAmbient(ctx,T,BW,BH,f);
      drawCustomerArea(ctx,T,BW,BH,g.orders,f);
      drawLighting(ctx,T,BW,BH,f,g);
      const rushActive=(g.rushEnd||0)>Date.now();
      const freezeActive=(g.freezeEnd||0)>Date.now();
      if(freezeActive){
        ctx.fillStyle="#6fd7ff10";
        ctx.fillRect(0,0,BW,BH);
        ctx.fillStyle="#b7ecff12";
        ctx.fillRect(0,0,BW,T*.82);
      }
      if(rushActive){
        ctx.strokeStyle="#ffb74d55";
        ctx.lineWidth=4;
        ctx.strokeRect(2,2,BW-4,BH-4);
      }

      const sp=[...g.players].sort((a,b)=>a.vr-b.vr);
      for(const p of sp){
        const px=p.vc*T+2,py=p.vr*T-6;
        const moving=Math.abs(p.r-p.vr)>.03||Math.abs(p.c-p.vc)>.03;
        ctx.fillStyle="#00000033";ctx.fillRect(px+4,py+T-4,T-12,6);
        if(rushActive){
          drawRushTrail(ctx,px+4,py+8,T-8,p.dir,f,moving);
          ctx.fillStyle=moving?"#ffda8a44":"#ffb74d22";
          ctx.fillRect(px-2,py+4,T,T);
        }
        if(p.processing){const pct=1-(p.processing.end-Date.now())/p.processing.dur;ctx.fillStyle="#000000aa";ctx.fillRect(px,py+T+2,T-4,5);ctx.fillStyle=P.green;ctx.fillRect(px+1,py+T+3,(T-6)*Math.min(1,pct),3);if(pct>.8){ctx.fillStyle="#4caf5044";ctx.fillRect(px-2,py-2,T,T+8);}}
        drawChar(ctx,px+4,py+8,T-8,p.clr,p.dir,p.af,p.squash);
        drawTextOutlined(ctx,`P${p.id+1}`,px+T/2-2,py+T+10,p.clr.main,"#120904",`bold ${Math.max(9,T*.2)}px 'Outfit','Silkscreen',sans-serif`);
        const[dr2,dc2]=DIRS[p.dir];ctx.fillStyle=p.clr.main+"55";ctx.fillRect(px+T/2-3+dc2*12,py+T/2+dr2*12,5,5);
        if(p.holding){const hx=px+T-10,hy=py-4,bob=Math.sin(f*.1)*2;ctx.fillStyle="#000000aa";ctx.beginPath();ctx.arc(hx+6,hy+4,10,0,Math.PI*2);ctx.fill();drawCup(ctx,hx-2,hy+bob-4,14,p.holding.ingredients||[]);}
      }
      parts.current.draw(ctx);
      for(const pp of g.popups){const a=pp.life/pp.ml;ctx.globalAlpha=a;const popFont=`bold ${pp.type==="combo"?18:14}px 'Outfit','Silkscreen',sans-serif`;const popFill=pp.type==="good"?P.gold:pp.type==="combo"?"#ff4081":P.red;drawTextOutlined(ctx,pp.text,pp.x,pp.y,popFill,"#120904",popFont);ctx.globalAlpha=1;}
      ctx.restore();

      // â”€â”€â”€ DRINK PREVIEW HUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const p0 = g.players[0];
      const hasItem = p0.holding && p0.holding.type === "cup";
      if (hasItem) {
        const ings = p0.holding.ingredients || [];
        const isProc = !!p0.processing;
        const procPct = isProc ? Math.min(1, 1 - (p0.processing.end - Date.now()) / p0.processing.dur) : 0;
        const procIng = isProc ? p0.processing.ingredient : null;

        // Panel dimensions - bottom right corner
        const pw = Math.min(100, BW * 0.2);
        const ph = pw * 1.35;
        const px2 = BW - pw - 6;
        const py2 = BH - ph - 6;
        const rad = 8;

        // Panel background with rounded corners
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(px2 + rad, py2);
        ctx.lineTo(px2 + pw - rad, py2);
        ctx.quadraticCurveTo(px2 + pw, py2, px2 + pw, py2 + rad);
        ctx.lineTo(px2 + pw, py2 + ph - rad);
        ctx.quadraticCurveTo(px2 + pw, py2 + ph, px2 + pw - rad, py2 + ph);
        ctx.lineTo(px2 + rad, py2 + ph);
        ctx.quadraticCurveTo(px2, py2 + ph, px2, py2 + ph - rad);
        ctx.lineTo(px2, py2 + rad);
        ctx.quadraticCurveTo(px2, py2, px2 + rad, py2);
        ctx.closePath();
        ctx.fillStyle = "#1a0f08dd";
        ctx.fill();
        ctx.strokeStyle = P.gold + "55";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Cup drawing area
        const cx = px2 + pw / 2;
        const cupW = pw * 0.55;
        const cupH = ph * 0.52;
        const cupX = cx - cupW / 2;
        const cupY = py2 + 18;
        const cupBot = cupY + cupH;
        const s = cupW / 20; // pixel unit

        // Cup body - tapered shape
        ctx.fillStyle = "#f8f8f8";
        ctx.beginPath();
        ctx.moveTo(cupX + s * 2, cupY);           // top left
        ctx.lineTo(cupX + cupW - s * 2, cupY);    // top right
        ctx.lineTo(cupX + cupW - s * 3, cupBot);  // bottom right
        ctx.lineTo(cupX + s * 3, cupBot);          // bottom left
        ctx.closePath();
        ctx.fill();

        // Cup rim
        ctx.fillStyle = "#e0e0e0";
        ctx.fillRect(cupX + s, cupY - s * 1.5, cupW - s * 2, s * 2.5);
        // Cup bottom
        ctx.fillStyle = "#d0d0d0";
        ctx.fillRect(cupX + s * 2.5, cupBot, cupW - s * 5, s * 1.5);

        // Handle
        ctx.strokeStyle = "#d8d8d8";
        ctx.lineWidth = s * 1.5;
        ctx.beginPath();
        ctx.arc(cupX + cupW - s * 1, cupY + cupH * 0.4, cupH * 0.2, -Math.PI * 0.4, Math.PI * 0.4);
        ctx.stroke();

        // Fill layers from bottom
        if (ings.length > 0) {
          const fillH = cupH * 0.82;
          const fillY = cupY + cupH * 0.1;
          const layerH = fillH / Math.max(ings.length, 1);

          for (let i = ings.length - 1; i >= 0; i--) {
            const ing = ings[i];
            const ly = fillY + fillH - (ings.length - i) * layerH;
            const lh = layerH;
            // Tapered width at this height
            const pctDown = (ly - cupY) / cupH;
            const taper = 1 - pctDown * 0.08;
            const lx = cupX + s * 2.5 + (cupW - s * 5) * (1 - taper) / 2;
            const lw = (cupW - s * 5) * taper;

            ctx.fillStyle = ING_C[ing] || "#888";
            ctx.fillRect(lx, ly, lw, lh);

            // Detail per ingredient type
            if (ing === "foam") {
              // Bubbly top
              ctx.fillStyle = "#ffffff";
              for (let b = 0; b < 5; b++) {
                const bx = lx + lw * 0.1 + (lw * 0.8) * (b / 4);
                const by2 = ly + lh * 0.2 + Math.sin(f * 0.05 + b) * 2;
                ctx.beginPath();ctx.arc(bx, by2, s * 0.8, 0, Math.PI * 2);ctx.fill();
              }
            }
            if (ing === "ice") {
              // Ice cubes
              ctx.fillStyle = P.iceS;
              for (let ib = 0; ib < 3; ib++) {
                const ix = lx + lw * 0.15 + ib * lw * 0.3;
                const iy = ly + lh * 0.2;
                ctx.fillRect(ix, iy, s * 2.5, s * 2.5);
                ctx.fillStyle = "#ffffff66";
                ctx.fillRect(ix + s * 0.3, iy + s * 0.3, s, s);
                ctx.fillStyle = P.iceS;
              }
            }
            if (ing === "caramel") {
              // Drizzle lines
              ctx.strokeStyle = "#a06808";
              ctx.lineWidth = 1;
              for (let d = 0; d < 3; d++) {
                ctx.beginPath();
                ctx.moveTo(lx + lw * 0.2 + d * lw * 0.25, ly);
                ctx.bezierCurveTo(lx + lw * 0.3 + d * lw * 0.2, ly + lh * 0.5, lx + lw * 0.15 + d * lw * 0.3, ly + lh * 0.7, lx + lw * 0.25 + d * lw * 0.25, ly + lh);
                ctx.stroke();
              }
            }
            if (ing === "strawberry") {
              // Little berry bits
              ctx.fillStyle = "#ff8099";
              for (let sb = 0; sb < 4; sb++) {
                const sx2 = lx + lw * 0.15 + sb * lw * 0.22;
                const sy2 = ly + lh * 0.3 + Math.sin(sb * 2.1) * lh * 0.2;
                ctx.fillRect(sx2, sy2, s * 1.2, s * 1.2);
              }
            }
            if (ing === "matcha") {
              // Swirl pattern
              ctx.fillStyle = "#4a8a3c55";
              for (let ms = 0; ms < 3; ms++) {
                const mx = lx + lw * 0.2 + ms * lw * 0.25;
                const my = ly + lh * 0.4;
                ctx.beginPath();ctx.arc(mx, my, s * 1.2, 0, Math.PI * 2);ctx.fill();
              }
            }
            if (ing === "espresso" || ing === "espresso2") {
              // Crema on top of espresso layer
              if (i === 0 || ings[i - 1] !== "espresso") {
                ctx.fillStyle = "#8B5E3C";
                ctx.fillRect(lx, ly, lw, s * 1.5);
              }
            }

            // Layer divider line
            if (i > 0) {
              ctx.fillStyle = "#00000015";
              ctx.fillRect(lx, ly, lw, 1);
            }
          }
        }

        // POUR ANIMATION when processing
        if (isProc && procIng) {
          const pourClr = ING_C[procIng] || "#888";
          const pourX = cx;
          const pourTopY = cupY - 12;
          const pourBotY = cupY + 4;
          const pourW = s * 2;
          const pourEase = procPct * procPct * (3 - 2 * procPct);

          ctx.fillStyle = "#f4e7c8";
          ctx.fillRect(pourX - s * 2, pourTopY - s * 1.5, s * 4, s * 1.2);
          ctx.fillStyle = pourClr;
          ctx.fillRect(pourX - s, pourTopY - s * 0.5, s * 2, s * 1.5);

          // Stream
          ctx.fillStyle = pourClr;
          const streamH = (pourBotY - pourTopY) * (0.12 + pourEase * 0.88);
          ctx.fillRect(pourX - pourW / 2, pourTopY, pourW, streamH);

          // Droplets
          ctx.fillStyle = pourClr + "bb";
          for (let dr = 0; dr < 3; dr++) {
            const dy = pourTopY + streamH + dr * 4 + (f % 14) * 0.3;
            if (dy < pourBotY + 8) {
              ctx.beginPath();
              ctx.arc(pourX + (Math.sin(f * 0.12 + dr) * 3), dy, s * 0.6, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          // Splash at surface
          if (pourEase > 0.38) {
            ctx.fillStyle = pourClr + "44";
            for (let sp = 0; sp < 4; sp++) {
              const angle = (sp / 4) * Math.PI + f * 0.05;
              const dist2 = s * 2 + Math.sin(f * 0.1 + sp) * s;
              ctx.beginPath();
              ctx.arc(pourX + Math.cos(angle) * dist2, pourBotY + Math.sin(angle) * s, s * 0.5, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          // Progress arc around cup
          ctx.strokeStyle = P.green;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cupY + cupH / 2, cupW / 2 + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pourEase);
          ctx.stroke();
        }

        // Steam for hot drinks
        const hotIngs = ["espresso","espresso2","steamed_milk","hot_water","tea"];
        const hasHot = ings.some(i2 => hotIngs.includes(i2));
        const hasCold = ings.includes("ice");
        if (hasHot && !hasCold && ings.length > 0) {
          ctx.fillStyle = "#ffffff";
          for (let si = 0; si < 3; si++) {
            const sx3 = cx - 6 + si * 6;
            const sy3 = cupY - 6 - Math.sin(f * 0.06 + si * 1.5) * 5 - (f % 30) * 0.3;
            const sa = 0.15 + Math.sin(f * 0.04 + si) * 0.1;
            ctx.globalAlpha = sa;
            ctx.beginPath();ctx.arc(sx3, sy3, 2 + Math.sin(f * 0.08 + si) * 1, 0, Math.PI * 2);ctx.fill();
          }
          ctx.globalAlpha = 1;
        }

        // Condensation drops for cold drinks
        if (hasCold) {
          ctx.fillStyle = "#9dd5ef55";
          for (let cd = 0; cd < 4; cd++) {
            const cdx = cupX + s * 3 + cd * cupW * 0.22;
            const cdy = cupY + cupH * 0.3 + Math.sin(cd * 3 + f * 0.01) * cupH * 0.2 + (f % 120) * 0.15;
            if (cdy < cupBot - 4) {
              ctx.beginPath();ctx.arc(cdx, cdy, s * 0.5, 0, Math.PI * 2);ctx.fill();
            }
          }
        }

        // Drink name when recipe matches
        const matched = ings.length > 0 ? matchRecipe(ings) : null;
        ctx.font = `bold ${Math.max(7, pw * 0.09)}px monospace`;
        ctx.textAlign = "center";
        if (matched) {
          // Glow
          ctx.fillStyle = P.gold + "44";
          ctx.fillRect(px2 + 4, py2 + ph - 18, pw - 8, 14);
          ctx.fillStyle = P.gold;
          ctx.fillText(matched, cx, py2 + ph - 8);
        } else if (ings.length > 0) {
          ctx.fillStyle = "#c4956a88";
          ctx.fillText(ings.length + " ingredient" + (ings.length > 1 ? "s" : ""), cx, py2 + ph - 8);
        } else {
          ctx.fillStyle = "#6b3a1f88";
          ctx.fillText("Empty cup", cx, py2 + ph - 8);
        }

        // P1 indicator
        ctx.fillStyle = p0.clr.main;
        ctx.font = `bold ${Math.max(6, pw * 0.07)}px monospace`;
        ctx.fillText("P1", px2 + 14, py2 + 10);

        ctx.restore();
      }

      // â”€â”€â”€ P2 DRINK PREVIEW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      if (playerCount === 2) {
        const p1b = g.players[1];
        if (p1b && p1b.holding && p1b.holding.type === "cup") {
          const ings2 = p1b.holding.ingredients || [];
          const pw2 = Math.min(100, BW * 0.2);
          const ph2 = pw2 * 1.35;
          const px3 = 6;
          const py3 = BH - ph2 - 6;
          const cx2 = px3 + pw2 / 2;
          const s2 = pw2 * 0.55 / 20;

          // Panel
          ctx.save();
          ctx.fillStyle = "#1a0f08dd";
          ctx.beginPath();
          ctx.moveTo(px3 + 8, py3);ctx.lineTo(px3 + pw2 - 8, py3);ctx.quadraticCurveTo(px3 + pw2, py3, px3 + pw2, py3 + 8);
          ctx.lineTo(px3 + pw2, py3 + ph2 - 8);ctx.quadraticCurveTo(px3 + pw2, py3 + ph2, px3 + pw2 - 8, py3 + ph2);
          ctx.lineTo(px3 + 8, py3 + ph2);ctx.quadraticCurveTo(px3, py3 + ph2, px3, py3 + ph2 - 8);
          ctx.lineTo(px3, py3 + 8);ctx.quadraticCurveTo(px3, py3, px3 + 8, py3);
          ctx.closePath();ctx.fill();
          ctx.strokeStyle = P.p2 + "44";ctx.lineWidth = 1.5;ctx.stroke();

          // Small cup
          const cw2 = pw2 * 0.5, ch2 = ph2 * 0.45;
          const cx2b = cx2 - cw2 / 2, cy2b = py3 + 16;
          ctx.fillStyle = "#f8f8f8";
          ctx.fillRect(cx2b, cy2b, cw2, ch2);
          ctx.fillStyle = "#e0e0e0";
          ctx.fillRect(cx2b - 2, cy2b - 2, cw2 + 4, 3);

          // Layers
          if (ings2.length > 0) {
            const lh2 = (ch2 * 0.85) / ings2.length;
            for (let i = ings2.length - 1; i >= 0; i--) {
              const ly2 = cy2b + ch2 * 0.1 + (ch2 * 0.85) - (ings2.length - i) * lh2;
              ctx.fillStyle = ING_C[ings2[i]] || "#888";
              ctx.fillRect(cx2b + 2, ly2, cw2 - 4, lh2);
            }
          }

          const m2 = ings2.length > 0 ? matchRecipe(ings2) : null;
          ctx.font = `bold ${Math.max(6, pw2 * 0.08)}px monospace`;
          ctx.textAlign = "center";
          ctx.fillStyle = m2 ? P.gold : "#6b3a1f88";
          ctx.fillText(m2 || (ings2.length > 0 ? ings2.length + " ing." : "Empty"), cx2, py3 + ph2 - 8);

          ctx.fillStyle = P.p2;
          ctx.font = `bold ${Math.max(6, pw2 * 0.07)}px monospace`;
          ctx.fillText("P2", px3 + 14, py3 + 10);
          ctx.restore();
        }
      }

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);return ()=>{run=false;};
  },[onEnd,T,BW,BH,diff,isHost,online,onlineSession,doAction,tryMove,clearAutoTask,setAutoTarget,usePower,addPop,tutorialMode]);

  const mobileMove=(pid,dir)=>{sfx.init();handleMoveInput(pid,dir);};
  const mobileAct=(pid)=>{sfx.init();handleActionInput(pid);};
  const mobilePower=(kind)=>{handlePowerInput(kind);};
  const handleCanvasTarget=useCallback((e)=>{
    const cv=canvasRef.current;
    if(!cv)return;
    if(e.cancelable)e.preventDefault();
    e.stopPropagation?.();
    const point=("touches" in e&&e.touches?.length)?e.touches[0]:("changedTouches" in e&&e.changedTouches?.length)?e.changedTouches[0]:e;
    if(point?.clientX==null||point?.clientY==null)return;
    const rect=cv.getBoundingClientRect();
    const x=(point.clientX-rect.left)*(BW/rect.width);
    const y=(point.clientY-rect.top)*(BH/rect.height);
    const r=Math.max(0,Math.min(ROWS-1,Math.floor(y/T)));
    const c=Math.max(0,Math.min(COLS-1,Math.floor(x/T)));
    const cell=MAP[r]?.[c];
    const targetKind=cell?.type==="station"?"station":cell?.type==="counter"?"counter":"floor";
    const targetLabel=cell?.type==="station"?(cell.station==="serve"?"SERVE":(STATIONS[cell.station]?.short||"USE")):cell?.type==="counter"?"DROP":"GO";
    const accent=cell?.type==="station"?(cell.station==="serve"?"#ffd66b":(STATIONS[cell.station]?.clr||P.gold)):cell?.type==="counter"?"#f4c66b":"#9de7ff";
    mobileTapHighlight.current={r,c,kind:targetKind,label:targetLabel,accent,life:90,ml:90};
    if(online&&!isHost){sendOnlineInput({type:"target",r,c});return;}
    setAutoTarget(localPid,r,c);
  },[BW,BH,T,online,isHost,sendOnlineInput,setAutoTarget,localPid]);
  const handleCanvasPointerDown=useCallback((e)=>{
    if(e.pointerType==="touch")return;
    handleCanvasTarget(e);
  },[handleCanvasTarget]);
  const singleControlMode = playerCount === 1 || online;
  const localColor = localPid === 1 ? P.p2 : P.p1;
  const localHolding = hud.holding[localPid];
  const pcHelp = online
    ? (localPid === 0 ? "You are P1: WASD + E/Space | Q Rush | R Freeze" : "You are P2: Arrows + / | Q Rush | R Freeze")
    : "P1: WASD + E/Space | P2: Arrows + / | Q Rush | R Freeze";
  const isPortraitMobile = isMobile && screen.h > screen.w;
  const safeTop = "max(env(safe-area-inset-top), 10px)";
  const safeBottom = "max(env(safe-area-inset-bottom), 10px)";
  const safeLeft = "max(env(safe-area-inset-left), 8px)";
  const safeRight = "max(env(safe-area-inset-right), 8px)";
  const mobileOrders=[...hud.orders].sort((a,b)=>(a.patience-a.elapsed)-(b.patience-b.elapsed));
  const primaryMobileOrder=mobileOrders[0]||null;
  const queuedMobileOrders=mobileOrders.slice(1,3);
  const hiddenMobileOrders=Math.max(0,mobileOrders.length-3);
  const tutorialLabel=tutorialLesson?`${tutorialLesson.title} ${tutorialStepIdx+1}/${tutorialLesson.steps.length}`:null;

  if (isMobile) {
    if (isPortraitMobile) {
      return (
        <div style={{width:"100vw",height:"100dvh",minHeight:"100vh",background:"radial-gradient(circle at top,#3a2215 0%,#1a0f08 58%,#120904 100%)",paddingTop:safeTop,paddingBottom:safeBottom,paddingLeft:safeLeft,paddingRight:safeRight,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Silkscreen','Press Start 2P',monospace"}}>
          <div style={{maxWidth:420,background:"#1a0f08ee",border:`2px solid ${P.gold}66`,borderRadius:24,padding:"22px 20px",boxShadow:"0 20px 40px #00000055,inset 0 1px 0 #ffffff10",display:"flex",flexDirection:"column",alignItems:"center",gap:16,textAlign:"center"}}>
            <div style={{display:"flex",gap:12,alignItems:"center",justifyContent:"center"}}>
              <div style={{width:36,height:58,borderRadius:10,border:"2px solid #8a6a4a",background:"#120904",position:"relative",boxShadow:"inset 0 0 0 2px #ffffff08"}}>
                <div style={{position:"absolute",top:8,left:10,right:10,height:4,borderRadius:3,background:"#3a2215"}}/>
                <div style={{position:"absolute",left:14,right:14,bottom:10,height:24,borderRadius:10,background:"#3a2215"}}/>
              </div>
              <div style={{color:P.gold,fontSize:12,letterSpacing:1}}>TO</div>
              <div style={{width:58,height:36,borderRadius:10,border:`2px solid ${P.gold}88`,background:"#120904",position:"relative",boxShadow:`0 0 18px ${P.gold}22,inset 0 0 0 2px #ffffff08`}}>
                <div style={{position:"absolute",top:8,left:8,right:8,height:4,borderRadius:3,background:"#6b3a1f"}}/>
                <div style={{position:"absolute",left:10,bottom:8,width:16,height:16,borderRadius:"50%",background:"#4fc3f7aa"}}/>
                <div style={{position:"absolute",right:10,bottom:8,width:16,height:16,borderRadius:"50%",background:"#f48fb1aa"}}/>
              </div>
            </div>
            <div style={{fontSize:22,color:P.gold,letterSpacing:2,textShadow:`0 0 16px ${P.gold}33`}}>ROTATE TO PLAY</div>
            <div style={{fontSize:10,lineHeight:1.8,color:"#f5e6d3",maxWidth:320}}>
              Matches use landscape so the whole cafe, order rail, and both baristas stay readable on phones.
            </div>
            <div style={{fontSize:8,lineHeight:1.8,color:"#8a6a4a",maxWidth:320}}>
              Menus and room setup work in portrait. Gameplay is landscape-first for a cleaner cross-platform feel.
            </div>
            <ShellActionRow appShell={appShell} />
          </div>
        </div>
      );
    }

    const shortSide=Math.min(screen.w,screen.h);
    const joySize=singleControlMode?Math.min(98,Math.max(80,Math.round(shortSide*.23))):Math.min(84,Math.max(68,Math.round(shortSide*.19)));
    const duoActW=60,duoActH=34;
    const mapTheme=getActiveMapDef().theme||{};
    const glowRgb=mapTheme.glow||"210,169,121";
    const topHudHeight=46;
    const orderHudHeight=primaryMobileOrder?52:40;
    const playScale=Math.max(.62,Math.min((screen.w-8)/BW,(screen.h-8)/BH,1.92));
    const displayW=Math.round(BW*playScale);
    const displayH=Math.round(BH*playScale);
    const boardLeft=Math.max(0,Math.round((screen.w-displayW)/2));
    const boardTop=Math.max(4,Math.round((screen.h-displayH)/2));
    const timerColor=hud.time<=30?P.red:hud.time<=60?P.orange:"#d2a979";
    const glass={
      background:"linear-gradient(180deg,#1d0f0a8c 0%,#13090573 100%)",
      border:"1px solid #c79c7228",
      boxShadow:"0 8px 20px #00000018",
      backdropFilter:"blur(16px) saturate(1.1)",
    };
    const dockGlass={
      background:"linear-gradient(180deg,#180c085e 0%,#0f070452 100%)",
      border:"1px solid #c79c7216",
      boxShadow:"0 6px 16px #00000016",
      backdropFilter:"blur(10px) saturate(1.05)",
    };
    const hudPill={...glass,borderRadius:999,padding:"8px 12px",pointerEvents:"auto"};
    const utilityButtonStyle={...hudPill,display:"flex",alignItems:"center",justifyContent:"center",minWidth:48,cursor:"pointer",color:"#f5e6d3",fontSize:8,fontFamily:"'Silkscreen',monospace"};

    return (
      <div style={{width:"100vw",height:"100dvh",minHeight:"100vh",background:P.bg,overflow:"hidden",position:"relative",fontFamily:"'Silkscreen','Press Start 2P',monospace",paddingTop:safeTop,paddingBottom:safeBottom,paddingLeft:safeLeft,paddingRight:safeRight}}>
        <div style={{position:"absolute",inset:0,background:`radial-gradient(circle at 50% 46%, rgba(${glowRgb},0.18) 0%, rgba(39,21,13,0.32) 28%, rgba(18,9,4,0.88) 72%, ${P.bg} 100%)`}}/>
        <div style={{position:"absolute",inset:0,pointerEvents:"none"}}>
          <div style={{position:"absolute",left:boardLeft-26,top:boardTop-24,width:displayW+52,height:displayH+48,borderRadius:36,background:`radial-gradient(circle at center, rgba(${glowRgb},0.28) 0%, rgba(${glowRgb},0.08) 42%, transparent 74%)`,filter:"blur(28px)",opacity:.9}}/>
          <div style={{position:"absolute",left:boardLeft-10,top:boardTop-10,width:displayW+20,height:displayH+20,borderRadius:32,background:"linear-gradient(180deg,#ffffff08 0%,transparent 24%,#0000001a 100%)",opacity:.9}}/>
        </div>

        <div style={{position:"absolute",left:boardLeft,top:boardTop,width:displayW,height:displayH,pointerEvents:"none"}}>
          <canvas ref={canvasRef} width={BW} height={BH} onPointerDown={handleCanvasPointerDown} onTouchStart={handleCanvasTarget} style={{width:displayW,height:displayH,imageRendering:"pixelated",display:"block",cursor:"pointer",borderRadius:26,boxShadow:"0 18px 38px #00000038",touchAction:"manipulation",pointerEvents:"auto"}} />
          <div style={{position:"absolute",inset:0,pointerEvents:"none",borderRadius:26,background:"radial-gradient(circle at center,transparent 56%,#00000012 100%),linear-gradient(180deg,#ffffff09 0%,transparent 22%,#00000020 100%)"}}/>
        </div>

        <div style={{position:"absolute",inset:0,pointerEvents:"none"}}>
          <div style={{position:"absolute",top:4,left:4,right:4,display:"grid",gridTemplateColumns:"auto 1fr auto",alignItems:"start",gap:8}}>
            <div style={{...hudPill,display:"flex",alignItems:"center",gap:8,minWidth:96}}>
              <span style={{fontSize:9,color:"#d2a979"}}>PTS</span>
              <span style={{color:P.gold,fontSize:16,fontWeight:"bold"}}>{hud.score}</span>
              {hud.combo>=2&&<span style={{color:"#ff7ab8",fontSize:7,animation:"pulse .5s infinite"}}>x{hud.combo}</span>}
            </div>
            <div style={{display:"flex",justifyContent:"center"}}>
              {tutorialMode
                ? <button onClick={()=>setCoachOpen(true)} style={{...glass,borderRadius:16,padding:"6px 10px",minWidth:164,maxWidth:260,width:"min(46vw,260px)",pointerEvents:"auto",fontSize:8,color:"#f5e6d3",textAlign:"center",lineHeight:1.5,display:"flex",alignItems:"center",justifyContent:"center",gap:6,cursor:"pointer",fontFamily:"'Silkscreen',monospace",border:`1px solid ${tutorialLesson?.color||"#c79c72"}28`}}>
                    <CatCoachAvatar size={18}/>
                    <span>{tutorialLabel}</span>
                  </button>
                : <div style={{...glass,borderRadius:16,padding:"7px 10px",minWidth:150,maxWidth:220,width:"min(38vw,220px)",pointerEvents:"auto"}}>
                    <PowerMeter hud={hud} compact />
                  </div>}
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",alignItems:"center",gap:8}}>
              <div style={{...hudPill,display:"flex",alignItems:"center",justifyContent:"center",minWidth:74}}>
                <span style={{color:timerColor,fontSize:14,fontWeight:"bold",...(hud.time<=10?{animation:"pulse .3s infinite"}:{})}}>{~~(hud.time/60)}:{String(hud.time%60).padStart(2,"0")}</span>
              </div>
              <button onClick={()=>{setMobileUtilityOpen((open)=>!open);setMobileQueueOpen(false);}} style={utilityButtonStyle}>MENU</button>
            </div>
          </div>

          <div style={{position:"absolute",top:Math.max(44,boardTop+10),left:boardLeft,width:displayW,display:"flex",justifyContent:"center",pointerEvents:"auto"}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"center",gap:6,maxWidth:displayW}}>
              <FocusOrderCard order={primaryMobileOrder} queueCount={mobileOrders.length?mobileOrders.length-1:0} onToggleQueue={()=>{setMobileQueueOpen((open)=>!open);setMobileUtilityOpen(false);}} />
              {!!mobileOrders.length&&(
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {queuedMobileOrders.map((order)=>(
                    <OrderQueueChip key={order.id} order={order} onClick={()=>setMobileQueueOpen(true)} />
                  ))}
                  {hiddenMobileOrders>0&&<OrderQueueChip extraLabel={`+${hiddenMobileOrders}`} onClick={()=>setMobileQueueOpen(true)} />}
                </div>
              )}
            </div>
          </div>

          {mobileQueueOpen&&(
            <div onPointerDown={()=>setMobileQueueOpen(false)} onTouchStart={()=>setMobileQueueOpen(false)} style={{position:"absolute",inset:0,pointerEvents:"auto"}}>
              <div onPointerDown={(e)=>e.stopPropagation()} onTouchStart={(e)=>e.stopPropagation()} style={{position:"absolute",top:Math.max(90,boardTop+58),left:boardLeft,width:displayW,display:"flex",justifyContent:"center"}}>
                <div style={{...glass,borderRadius:22,padding:"10px 10px 8px",width:Math.min(displayW,420),maxHeight:156,display:"flex",flexDirection:"column",gap:8}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
                    <span style={{fontSize:9,color:P.gold}}>ORDER QUEUE</span>
                    <button onClick={()=>setMobileQueueOpen(false)} style={{fontFamily:"'Silkscreen',monospace",fontSize:8,padding:"6px 10px",borderRadius:999,border:"1px solid #6b3a1f66",background:"#160c08b8",color:"#d8b48c",cursor:"pointer"}}>CLOSE</button>
                  </div>
                  <div style={{display:"flex",gap:8,overflowX:"auto",WebkitOverflowScrolling:"touch",touchAction:"pan-x",paddingBottom:2}}>
                    {mobileOrders.map((order)=><OrderTicket key={order.id} o={order} compact />)}
                    {!mobileOrders.length&&<div style={{fontSize:9,color:"#b58a64",padding:"12px 10px"}}>No active orders.</div>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {mobileUtilityOpen&&<MobileUtilityMenu appShell={appShell} audioUi={audioUi} onClose={()=>setMobileUtilityOpen(false)} />}

          {tutorialMode&&coachOpen&&singleControlMode&&(
            <div style={{position:"absolute",top:48,left:0,right:0,display:"flex",justifyContent:"center",pointerEvents:"none",zIndex:5}}>
              <CatCoachBubble text={coachMsg} type={coachMsgType} tip={coachTip} ingredients={RECIPES[tutorialStep?.drink]?.ing||[]} stepLabel={`${tutorialStepIdx+1}/${tutorialLesson.steps.length}`} trackColor={tutorialLesson.color} isMobile onClose={()=>setCoachOpen(false)} onReset={()=>{const g=gs.current;if(g){applyTutorialStepState(g,tutorialStepRef.current);setHud(toHudState(g));const s=tutorialLesson?.steps[tutorialStepRef.current];if(s){setCoachMsg(s.mentor);setCoachTip(s.tip||"");setCoachMsgType("step");setCoachOpen(true);}}}} onExit={()=>onTutorialExit?.()} />
            </div>
          )}

          {tutorialMode&&!coachOpen&&singleControlMode&&(
            <div style={{position:"absolute",left:8,bottom:8,pointerEvents:"auto"}}>
              <button onClick={()=>setCoachOpen(true)} style={{display:"flex",alignItems:"center",gap:4,background:"linear-gradient(180deg,#21120cd9 0%,#120904c7 100%)",border:`1px solid ${tutorialLesson?.color||"#8fce7e"}66`,borderRadius:999,padding:"4px 10px 4px 5px",cursor:"pointer",boxShadow:"0 4px 12px #00000020",backdropFilter:"blur(12px)",fontFamily:"'Silkscreen',monospace"}}>
                <CatCoachAvatar size={24}/>
                <span style={{fontSize:7,color:"#c4956a"}}>?</span>
              </button>
            </div>
          )}

          {singleControlMode ? (
            <>
              <div style={{position:"absolute",left:8,bottom:tutorialMode&&!coachOpen?42:8,pointerEvents:"auto"}}>
                <div style={{...glass,borderRadius:14,padding:"6px 8px",fontSize:7,color:"#e7c39c",textAlign:"left",lineHeight:1.45,maxWidth:132}}>
                  Tap floor to move.
                  <br />
                  Tap stations and counters to use them.
                </div>
              </div>
              <div style={{position:"absolute",right:6,bottom:6,display:"flex",flexDirection:"column",alignItems:"center",gap:6,pointerEvents:"auto"}}>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,minWidth:96}}>
                  <div style={{...dockGlass,borderRadius:16,padding:"7px 9px",minWidth:96,display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
                    <div style={{fontSize:7,color:"#cba27b"}}>{localHolding?"HOLDING":"HANDS FREE"}</div>
                    {!localHolding&&<div style={{fontSize:7,color:"#f5e6d3"}}>TAP TO PICK</div>}
                    {localHolding&&<div style={{display:"flex",gap:4,flexWrap:"wrap",justifyContent:"center"}}>
                      {localHolding.ingredients?.length===0?<span style={{fontSize:8,color:"#f5e6d3"}}>CUP</span>:
                        localHolding.ingredients?.map((ing,i)=><div key={i} style={{width:11,height:11,borderRadius:3,background:ING_C[ing],border:"1px solid #fff2",boxShadow:"inset 0 1px 0 #ffffff22"}}/>)}
                    </div>}
                  </div>
                  {!tutorialMode&&<div style={{...dockGlass,borderRadius:16,padding:"4px 5px"}}><PowerButtons hud={hud} onUsePower={mobilePower} compact stack /></div>}
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{position:"absolute",left:6,bottom:6,display:"flex",flexDirection:"column",alignItems:"center",gap:6,pointerEvents:"auto"}}>
                <button onTouchStart={e => {e.preventDefault(); mobileAct(0); haptic("medium");}} style={{width:duoActW,height:duoActH,borderRadius:16,...dockGlass,background:P.p1+"24",border:`1px solid ${P.p1}88`,color:P.p1,fontSize:10,fontFamily:"'Silkscreen',monospace",fontWeight:"bold",touchAction:"manipulation"}}>ACT</button>
                <div style={{...dockGlass,borderRadius:18,padding:"4px"}}><Joystick onMove={d => mobileMove(0,d)} color={P.p1} label="P1" side="left" size={joySize} /></div>
              </div>
              <div style={{position:"absolute",right:6,bottom:6,display:"flex",flexDirection:"column",alignItems:"center",gap:6,pointerEvents:"auto"}}>
                <button onTouchStart={e => {e.preventDefault(); mobileAct(1); haptic("medium");}} style={{width:duoActW,height:duoActH,borderRadius:16,...dockGlass,background:P.p2+"24",border:`1px solid ${P.p2}88`,color:P.p2,fontSize:10,fontFamily:"'Silkscreen',monospace",fontWeight:"bold",touchAction:"manipulation"}}>ACT</button>
                <div style={{...dockGlass,borderRadius:18,padding:"4px"}}><Joystick onMove={d => mobileMove(1,d)} color={P.p2} label="P2" side="right" size={joySize} /></div>
              </div>
              <div style={{position:"absolute",left:"50%",bottom:6,transform:"translateX(-50%)",pointerEvents:"auto"}}>
                <div style={{...dockGlass,borderRadius:18,padding:"8px 10px"}}><PowerButtons hud={hud} onUsePower={mobilePower} compact /></div>
              </div>
            </>
          )}
        </div>
      </div>);
  }

  // PC
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",height:"100%",background:P.bg,fontFamily:"'Silkscreen','Press Start 2P',monospace",overflow:"hidden"}}>
      <div style={{display:"flex",width:"100%",maxWidth:BW+12,justifyContent:"space-between",padding:"10px 14px 8px",color:"#f5e6d3",fontSize:14,alignItems:"center",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{color:"#d2a979",fontSize:11}}>PTS</span><span style={{color:P.gold,fontSize:20,fontWeight:"bold"}}>{hud.score}</span></div>
        {hud.combo>=2&&<div style={{color:"#ff4081",fontSize:12,animation:"pulse .5s infinite"}}>x{hud.combo} COMBO!</div>}
        <div style={{color:hud.time<=30?P.red:hud.time<=60?P.orange:"#d2a979",fontSize:16,fontWeight:"bold",...(hud.time<=10?{animation:"pulse .3s infinite"}:{})}}>{~~(hud.time/60)}:{String(hud.time%60).padStart(2,"0")}</div>
      </div>
      <div style={{display:"flex",gap:8,maxWidth:BW+12,padding:"0 10px 8px",justifyContent:"center",flexWrap:"wrap",flexShrink:0}}>
        <ShellActionRow appShell={appShell} compact />
        <AudioToggleRow audioUi={audioUi} compact />
      </div>
      {tutorialMode
        ? <div style={{display:"flex",gap:10,maxWidth:BW+12,padding:"0 10px 8px",justifyContent:"center",alignItems:"center",flexWrap:"wrap",flexShrink:0}}>
            {coachOpen
              ? <CatCoachBubble text={coachMsg} type={coachMsgType} tip={coachTip} ingredients={RECIPES[tutorialStep?.drink]?.ing||[]} stepLabel={`${tutorialStepIdx+1}/${tutorialLesson.steps.length}`} trackColor={tutorialLesson.color} onClose={()=>setCoachOpen(false)} onReset={()=>{const g=gs.current;if(g){applyTutorialStepState(g,tutorialStepRef.current);setHud(toHudState(g));const s=tutorialLesson?.steps[tutorialStepRef.current];if(s){setCoachMsg(s.mentor);setCoachTip(s.tip||"");setCoachMsgType("step");setCoachOpen(true);}}}} onExit={()=>onTutorialExit?.()} />
              : <button onClick={()=>setCoachOpen(true)} style={{display:"flex",alignItems:"center",gap:6,background:"#1a0f08dd",border:`1px solid ${tutorialLesson.color}66`,borderRadius:16,padding:"6px 12px",cursor:"pointer",fontFamily:"'Silkscreen',monospace"}}>
                  <CatCoachAvatar size={22}/>
                  <span style={{fontSize:9,color:"#f5e6d3"}}>{tutorialLabel}</span>
                  <span style={{fontSize:7,color:"#c4956a"}}>CLICK FOR HELP</span>
                </button>}
          </div>
        : <div style={{display:"flex",gap:10,maxWidth:BW+12,padding:"0 10px 8px",justifyContent:"center",alignItems:"center",flexWrap:"wrap",flexShrink:0}}>
            <PowerMeter hud={hud} />
            <PowerButtons hud={hud} onUsePower={handlePowerInput} />
          </div>}
      <div style={{display:"flex",gap:6,maxWidth:BW+18,padding:"0 10px 8px",overflowX:"auto",flexShrink:0,minHeight:72}}>
        {hud.orders.map(o=><OrderTicket key={o.id} o={o}/>)}{!hud.orders.length&&<span style={{color:"#6b3a1f",fontSize:9,padding:12}}>Waiting for customers...</span>}
      </div>
      <canvas ref={canvasRef} width={BW} height={BH} onPointerDown={handleCanvasPointerDown} onTouchStart={handleCanvasTarget} style={{width:BW,height:BH,imageRendering:"pixelated",flexShrink:0,borderTop:`2px solid ${P.wallLine}`,borderBottom:`2px solid ${P.wallLine}`,boxShadow:"0 16px 30px #0000004d",cursor:"pointer",touchAction:"manipulation"}}/>
      <div style={{display:"flex",flexWrap:"wrap",gap:4,maxWidth:BW+18,padding:"8px 10px 6px",justifyContent:"center",flexShrink:0}}>
        {Object.entries(RECIPES).map(([n,r])=><div key={n} style={{background:"#2d1b0e",borderRadius:6,padding:"4px 7px",fontSize:7,color:"#9f7d59",border:"1px solid #4a2a18",display:"flex",alignItems:"center",gap:3,fontFamily:"'Silkscreen',monospace",boxShadow:"inset 0 1px 0 #ffffff12"}}>
          <span style={{color:getRecipeUiColor(n),fontWeight:"bold"}}>{n}</span>{r.ing.map((ing,i)=><div key={i} style={{width:9,height:9,borderRadius:1,background:ING_C[ing],border:"1px solid #fff1"}}/>)}
        </div>)}
      </div>
      <div style={{padding:"6px 0 10px",fontSize:9,color:"#8d6540",textAlign:"center",fontFamily:"'Silkscreen',monospace"}}>{pcHelp}</div>
      {playerCount===2&&!online&&<div style={{display:"flex",gap:12,padding:"4px",justifyContent:"center"}}><DPad pid={0} onInput={(p,d)=>d==="action"?mobileAct(p):mobileMove(p,d)} label="P1" color={P.p1}/><DPad pid={1} onInput={(p,d)=>d==="action"?mobileAct(p):mobileMove(p,d)} label="P2" color={P.p2}/></div>}
    </div>
  );
}

// â”€â”€â”€ TITLE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function TitleScreen({onStart,onOpenOnline,onOpenTraining,isMobile,forceMode,setForceMode,appShell,audioUi,initialMapKey="classic"}){
  const[mode,setMode]=useState(null);const[dif,setDif]=useState(null);const[help,setHelp]=useState(false);const[mapKey,setMapKey]=useState(initialMapKey);
  const[p1Char,setP1Char]=useState("bean");const[p2Char,setP2Char]=useState("mocha");
  const canvasRef=useRef(null);
  const screen=useScreen();
  const mobileLandscape=isMobile&&screen.w>screen.h;
  const menuPadTop=isMobile?(mobileLandscape?18:28):20;
  const menuPadBottom=isMobile?(mobileLandscape?44:56):24;
  const panelWidth=isMobile?(mobileLandscape?"min(100%, 760px)":"min(100%, 420px)"):"min(100%, 520px)";
  const utilityCompact=isMobile&&mobileLandscape;

  useEffect(()=>{
    const cv=canvasRef.current;if(!cv)return;const ctx=cv.getContext("2d");let f=0,run=true;
    const pts=Array.from({length:25},()=>({x:Math.random()*400,y:Math.random()*400,vx:(Math.random()-.5)*.5,vy:-.3-Math.random()*.5,sz:2+Math.random()*4,a:.2+Math.random()*.3}));
    const loop=()=>{if(!run)return;f++;ctx.fillStyle="#1a0f08";ctx.fillRect(0,0,400,400);for(const p of pts){p.x+=p.vx;p.y+=p.vy;if(p.y<-20){p.y=410;p.x=Math.random()*400;}ctx.globalAlpha=p.a*(.7+.3*Math.sin(f*.03+p.x));ctx.fillStyle="#d2a979";ctx.beginPath();ctx.arc(p.x,p.y,p.sz,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;requestAnimationFrame(loop);};
    loop();return ()=>{run=false;};
  },[]);

  const Bt=({onClick,children,big,dim,clr,wide=false})=>{
    const[h,sH]=useState(false);
    return <button onClick={onClick} style={{
      fontFamily:"'Silkscreen',monospace",fontWeight:"bold",
      fontSize:big?(isMobile?(mobileLandscape?17:19):14):(isMobile?(mobileLandscape?15:16):11),
      padding:big?(isMobile?(mobileLandscape?"18px 30px":"20px 38px"):"14px 32px"):(isMobile?(mobileLandscape?"16px 22px":"16px 26px"):"10px 20px"),
      background:dim?"#3a2215":h?(clr||"#8a4a2a"):(clr?"#3a2215":"#6b3a1f"),
      color:dim?(h?"#c4956a":"#8a6a4a"):clr||"#f5e6d3",
      border:`2px solid ${dim?"#5a3a20":clr?clr+"88":P.gold+"88"}`,
      borderRadius:12,cursor:"pointer",transition:"all .15s",
      textShadow:dim?"none":"0 1px 2px #00000066",
      boxShadow:big&&!dim?"0 4px 16px #00000044":"none",
      minWidth:isMobile?(mobileLandscape?160:180):undefined,
      width:wide?"100%":undefined,
      maxWidth:wide?"100%":undefined,
    }} onMouseEnter={()=>sH(true)} onMouseLeave={()=>sH(false)}>{children}</button>;
  };

  return (
    <div style={{position:"relative",width:"100%",height:"100%",overflow:"hidden",fontFamily:"'Silkscreen','Press Start 2P',monospace",color:"#f5e6d3"}}>
      <canvas ref={canvasRef} width={400} height={400} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}/>
      <div style={{position:"relative",zIndex:1,width:"100%",height:"100%",overflowY:"auto",WebkitOverflowScrolling:"touch",touchAction:"pan-y pinch-zoom"}}>
        <div style={{minHeight:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:isMobile?"flex-start":"center",paddingTop:`max(env(safe-area-inset-top), ${menuPadTop}px)`,paddingBottom:`max(env(safe-area-inset-bottom), ${menuPadBottom}px)`,paddingLeft:"max(env(safe-area-inset-left), 14px)",paddingRight:"max(env(safe-area-inset-right), 14px)"}}>
          <div style={{position:"relative",width:panelWidth,maxWidth:"100%",display:"flex",flexDirection:"column",alignItems:"center",gap:isMobile?(mobileLandscape?14:18):10,padding:isMobile?(mobileLandscape?"18px 16px 24px":"24px 18px 30px"):"20px",background:isMobile?"linear-gradient(180deg,#120904ee 0%,#1a0f08dd 100%)":"transparent",border:isMobile?"1px solid #6b3a1f66":"none",borderRadius:isMobile?26:0,boxShadow:isMobile?"0 24px 48px #00000044,inset 0 1px 0 #ffffff08":"none"}}>
            <div style={{fontSize:isMobile?(mobileLandscape?"clamp(34px,7vw,52px)":"clamp(38px,11vw,58px)"):"clamp(24px,7vw,48px)",fontWeight:"bold",color:P.gold,textShadow:`0 0 20px ${P.gold}44, 0 4px 0 #8b6914, 0 6px 0 #6b5010`,letterSpacing:isMobile?(mobileLandscape?3:4):4,textAlign:"center"}}>CAFE CHAOS</div>
            <div style={{fontSize:isMobile?(mobileLandscape?13:15):10,color:"#c4956a",letterSpacing:2,textAlign:"center"}}>A barista frenzy built for phone and PC.</div>
            {isMobile&&<div style={{fontSize:mobileLandscape?10:11,color:"#9a7a5c",letterSpacing:1,textAlign:"center",maxWidth:560,lineHeight:1.8}}>Portrait works well for setup. Landscape is best once the shift starts.</div>}
            <ShellActionRow appShell={appShell} compact={utilityCompact} />
            <AudioToggleRow audioUi={audioUi} compact={utilityCompact} />

            <div style={{display:"flex",gap:8,alignItems:"center",justifyContent:"center",flexWrap:"wrap",width:"100%"}}>
              {["mobile","pc"].map(m => {
                const active=(forceMode===m)||(!forceMode&&((m==="mobile")===isMobile));
                return (
                  <button key={m} onClick={()=>setForceMode(forceMode===m?null:m)} style={{
                    fontFamily:"'Silkscreen',monospace",fontSize:isMobile?(mobileLandscape?11:12):8,fontWeight:"bold",
                    padding:isMobile?(mobileLandscape?"10px 16px":"11px 18px"):"5px 12px",borderRadius:18,cursor:"pointer",transition:"all .15s",
                    background:active?`${m==="mobile"?P.p1:P.p2}22`:"transparent",
                    color:active?(m==="mobile"?P.p1:P.p2):"#7a5943",
                    border:`1.5px solid ${active?(m==="mobile"?P.p1:P.p2)+"66":"#3a221566"}`,
                  }}>
                    {m==="mobile"?"TOUCH MODE":"KEYBOARD MODE"}
                  </button>
                );
              })}
            </div>

            {help?
              <div style={{background:"#1a0f08ee",borderRadius:18,padding:isMobile?(mobileLandscape?"18px 18px 20px":"22px 18px 24px"):16,border:`2px solid ${P.gold}44`,width:"100%",fontSize:isMobile?(mobileLandscape?11:12):10,lineHeight:2,color:"#c4956a"}}>
                <div style={{color:P.gold,textAlign:"center",marginBottom:10,fontSize:isMobile?(mobileLandscape?16:18):12}}>HOW TO PLAY</div>
                {["1. Grab a cup from the cup station.","2. On phones, tap floors to move and tap stations or counters to use them.","3. Some stations brew, so watch the progress bar.","4. Place cups on counters to free your hands.","5. Serve at the bell counter when the recipe matches.","6. Great serves add time back to the clock.","7. Missed or bad orders burn clock time.","8. Chain serves to fill FLOW for powers."].map((t,i)=><div key={i} style={{color:"#e8a87c"}}>{t}</div>)}
                {!isMobile&&<div style={{marginTop:8,borderTop:"1px solid #3a2215",paddingTop:8}}>
                  <div>P1: <span style={{color:P.p1}}>WASD</span> + <span style={{color:P.p1}}>E/Space</span></div>
                  <div>P2: <span style={{color:P.p2}}>Arrows</span> + <span style={{color:P.p2}}>/</span></div>
                  <div>Powers: <span style={{color:P.gold}}>Q = Rush</span> and <span style={{color:"#9de7ff"}}>R = Freeze</span></div>
                </div>}
                {isMobile&&<div style={{marginTop:10,color:"#8a6a4a",textAlign:"center"}}>Tap floors to move and tap stations or counters to use them.</div>}
                <div style={{textAlign:"center",marginTop:18}}><Bt onClick={()=>setHelp(false)} wide={isMobile}>BACK</Bt></div>
              </div>
            : !mode ?
              <div style={{display:"flex",flexDirection:"column",gap:isMobile?(mobileLandscape?12:14):10,alignItems:"center",marginTop:4,width:"100%"}}>
                <div style={{fontSize:isMobile?(mobileLandscape?12:13):10,color:"#c4956a",textAlign:"center",lineHeight:1.8,maxWidth:520}}>Choose your shift style, then pick a difficulty and floor plan.</div>
                <div style={{display:"grid",gridTemplateColumns:isMobile?(mobileLandscape?"repeat(2, minmax(0, 1fr))":"1fr"):"repeat(2, minmax(0, 1fr))",gap:isMobile?12:10,width:"100%"}}>
                  <Bt onClick={()=>setMode(1)} big wide={isMobile}>SOLO</Bt>
                  <Bt onClick={()=>setMode(2)} big wide={isMobile}>DUO</Bt>
                </div>
                <div style={{display:"grid",gridTemplateColumns:isMobile&&!mobileLandscape?"1fr":"repeat(2, minmax(0, 1fr))",gap:isMobile?12:10,width:"100%"}}>
                  <Bt onClick={()=>setHelp(true)} dim wide={isMobile}>HOW TO PLAY</Bt>
                  <Bt onClick={onOpenTraining} clr={P.p1} wide={isMobile}>TRAINING</Bt>
                </div>
                <Bt onClick={onOpenOnline} big clr={P.gold} wide>ONLINE ROOM</Bt>
              </div>
            : !dif ?
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:isMobile?(mobileLandscape?12:14):10,marginTop:4,width:"100%"}}>
                <div style={{fontSize:isMobile?(mobileLandscape?13:14):10,color:"#c4956a",textAlign:"center"}}>Choose your vibe:</div>
                <div style={{display:"grid",gridTemplateColumns:isMobile?(mobileLandscape?"repeat(2, minmax(0, 1fr))":"1fr"):"1fr",gap:isMobile?12:10,width:"100%"}}>
                  {Object.entries(DIFF).map(([k,d])=>
                    <button key={k} onClick={()=>setDif(k)} style={{
                      fontFamily:"'Silkscreen',monospace",fontWeight:"bold",
                      width:"100%",padding:isMobile?(mobileLandscape?"16px 18px":"18px 20px"):"12px 18px",
                      background:"#2d1b0e",border:`2px solid ${d.clr}66`,borderRadius:14,
                      cursor:"pointer",textAlign:"left",transition:"all .15s",
                      display:"flex",flexDirection:"column",gap:6,
                    }}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=d.clr}
                    onMouseLeave={e=>e.currentTarget.style.borderColor=d.clr+"66"}>
                      <span style={{fontSize:isMobile?(mobileLandscape?15:16):12,color:d.clr}}>{d.label}</span>
                      <span style={{fontSize:isMobile?(mobileLandscape?11:12):8,color:"#b38a68",lineHeight:1.7}}>{d.desc}</span>
                      <span style={{fontSize:isMobile?(mobileLandscape?10:11):7,color:"#8a6a4a"}}>{d.time}s bank and patience x{d.patMul}</span>
                    </button>
                  )}
                </div>
                <Bt onClick={()=>setMode(null)} dim wide={isMobile}>BACK</Bt>
              </div>
            :
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:isMobile?(mobileLandscape?12:14):10,marginTop:4,width:"100%"}}>
                <div style={{fontSize:isMobile?(mobileLandscape?15:17):12,color:P.gold,textAlign:"center"}}>{mode===1?"SOLO":"DUO"} - {DIFF[dif].label}</div>
                <div style={{fontSize:isMobile?(mobileLandscape?12:13):9,color:"#c4956a",textAlign:"center",lineHeight:1.8}}>Choose your cafe layout:</div>
                <MapChoiceGrid selected={mapKey} onSelect={setMapKey} isMobile={isMobile} />
                <div style={{fontSize:isMobile?(mobileLandscape?12:13):9,color:"#c4956a",textAlign:"center",lineHeight:1.8,marginTop:6}}>Choose your barista{mode===2?"s":""}:</div>
                <CharacterSelectGrid p1Char={p1Char} p2Char={p2Char} onSelectP1={setP1Char} onSelectP2={setP2Char} playerCount={mode} isMobile={isMobile} />
                <div style={{display:"grid",gridTemplateColumns:isMobile&&!mobileLandscape?"1fr":"repeat(2, minmax(0, 1fr))",gap:isMobile?12:10,width:"100%"}}>
                  <Bt onClick={()=>{sfx.init();onStart(mode,dif,mapKey,p1Char,p2Char);}} big wide={isMobile}>START SHIFT</Bt>
                  <Bt onClick={()=>setDif(null)} dim wide={isMobile}>BACK</Bt>
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

function TutorialHubScreen({isMobile,onBack,onStartTutorial,completedIds=[],notice="",appShell,audioUi}){
  const screen=useScreen();
  const mobileLandscape=isMobile&&screen.w>screen.h;
  const panelWidth=isMobile?(mobileLandscape?"min(100%, 860px)":"min(100%, 430px)"):"min(100%, 820px)";
  const done=new Set(completedIds);
  return (
    <div style={{position:"relative",width:"100%",height:"100%",overflow:"hidden",background:"radial-gradient(circle at top,#3a2215 0%,#1a0f08 55%,#120904 100%)",fontFamily:"'Silkscreen',monospace",color:"#f5e6d3"}}>
      <div style={{position:"absolute",inset:0,overflowY:"auto",WebkitOverflowScrolling:"touch",touchAction:"pan-y pinch-zoom"}}>
        <div style={{minHeight:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:isMobile?"flex-start":"center",paddingTop:`max(env(safe-area-inset-top), ${isMobile?(mobileLandscape?18:28):22}px)`,paddingBottom:`max(env(safe-area-inset-bottom), ${isMobile?(mobileLandscape?44:56):24}px)`,paddingLeft:"max(env(safe-area-inset-left), 14px)",paddingRight:"max(env(safe-area-inset-right), 14px)"}}>
          <div style={{width:panelWidth,maxWidth:"100%",display:"flex",flexDirection:"column",alignItems:"center",gap:isMobile?(mobileLandscape?14:18):14,padding:isMobile?(mobileLandscape?"18px 16px 24px":"24px 18px 30px"):"24px 22px",background:isMobile?"linear-gradient(180deg,#120904ee 0%,#1a0f08dd 100%)":"transparent",border:isMobile?"1px solid #6b3a1f66":"none",borderRadius:isMobile?26:0,boxShadow:isMobile?"0 24px 48px #00000044,inset 0 1px 0 #ffffff08":"none",textAlign:"center"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:isMobile?10:12}}>
              <CatCoachAvatar size={isMobile?(mobileLandscape?36:42):38}/>
              <div style={{fontSize:isMobile?(mobileLandscape?28:32):24,color:P.gold,textShadow:`0 0 20px ${P.gold}44`}}>TRAINING BAR</div>
            </div>
            <div style={{fontSize:isMobile?(mobileLandscape?12:13):10,color:"#c4956a",maxWidth:640,lineHeight:1.85,fontFamily:"'Outfit','Silkscreen',sans-serif"}}>
              {CAT_COACH.name} the {CAT_COACH.role.toLowerCase()} will walk you through real drink builds one by one. Each lesson runs on the actual cafe stations, but without random rush pressure.
            </div>
            <ShellActionRow appShell={appShell} compact={isMobile&&mobileLandscape} />
            <AudioToggleRow audioUi={audioUi} compact={isMobile&&mobileLandscape} />
            {notice&&<div style={{width:"100%",maxWidth:520,background:"#2d1b0e",border:`2px solid ${P.green}88`,borderRadius:16,padding:isMobile?14:12,fontSize:isMobile?(mobileLandscape?11:12):9,color:"#dff3e4"}}>{notice}</div>}

            <div style={{display:"grid",gridTemplateColumns:isMobile?(mobileLandscape?"repeat(2, minmax(0, 1fr))":"1fr"):"repeat(2, minmax(0, 1fr))",gap:isMobile?12:14,width:"100%"}}>
              {Object.values(TRAINING_TRACKS).map((track)=>(
                <div key={track.id} style={{background:"#1a0f08dd",border:`2px solid ${track.color}66`,borderRadius:18,padding:isMobile?(mobileLandscape?"16px 14px":"18px 16px"):16,display:"flex",flexDirection:"column",gap:10,textAlign:"left",boxShadow:done.has(track.id)?"0 0 0 1px #ffffff10, 0 14px 30px #0000002c":"none"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
                    <div>
                      <div style={{fontSize:isMobile?(mobileLandscape?14:15):12,color:track.color}}>{track.title}</div>
                      <div style={{fontSize:isMobile?(mobileLandscape?10:11):8,color:"#8a6a4a",marginTop:4}}>{track.steps.length} lessons</div>
                    </div>
                    {done.has(track.id)&&<div style={{fontSize:isMobile?(mobileLandscape?9:10):8,color:P.green}}>CLEARED</div>}
                  </div>
                  <div style={{fontSize:isMobile?(mobileLandscape?11:12):9,color:"#d8b48c",lineHeight:1.8,fontFamily:"'Outfit','Silkscreen',sans-serif"}}>{track.subtitle}</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {track.drinks.map((drink)=><div key={drink} style={{background:"#2d1b0e",border:"1px solid #4a2a18",borderRadius:999,padding:"4px 8px",fontSize:isMobile?(mobileLandscape?9:10):7,color:getRecipeUiColor(drink)}}>{drink}</div>)}
                  </div>
                  <div style={{fontSize:isMobile?(mobileLandscape?10:11):8,color:"#c4956a",lineHeight:1.7}}>
                    {CAT_COACH.name} explains not just what to add, but why the recipe works that way.
                  </div>
                  <button onClick={()=>onStartTutorial(track.id)} style={{fontFamily:"'Silkscreen',monospace",fontWeight:"bold",fontSize:isMobile?(mobileLandscape?12:13):10,padding:isMobile?(mobileLandscape?"13px 16px":"14px 18px"):"10px 16px",background:"#6b3a1f",color:"#f5e6d3",border:`2px solid ${track.color}88`,borderRadius:12,cursor:"pointer",width:"100%"}}>START LESSON</button>
                </div>
              ))}
            </div>

            <button onClick={onBack} style={{fontFamily:"'Silkscreen',monospace",fontWeight:"bold",fontSize:isMobile?(mobileLandscape?13:14):10,padding:isMobile?(mobileLandscape?"13px 18px":"14px 18px"):"10px 16px",background:"transparent",color:"#8a6a4a",border:"2px solid #3a2215",borderRadius:12,cursor:"pointer",width:isMobile?"100%":undefined,maxWidth:260}}>BACK</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* TutorialCoachPanel removed — replaced by CatCoachBubble */

function OnlineRoomScreen({isMobile,onBack,onLaunch,initialRoomCode,appShell,audioUi,initialMapKey="classic"}){
  const [stage,setStage]=useState(initialRoomCode?"join":"menu");
  const [joinCode,setJoinCode]=useState(normalizeRoomCode(initialRoomCode));
  const [roomSession,setRoomSession]=useState(null);
  const [members,setMembers]=useState([]);
  const [status,setStatus]=useState("idle");
  const [error,setError]=useState("");
  const [diff,setDiff]=useState("normal");
  const [mapKey,setMapKey]=useState(initialMapKey);
  const [p1Char,setP1Char]=useState("bean");const[p2Char,setP2Char]=useState("mocha");
  const [busy,setBusy]=useState(false);
  const [copied,setCopied]=useState(false);
  const launched=useRef(false);
  const autoJoinTried=useRef(false);
  const screen=useScreen();
  const mobileLandscape=isMobile&&screen.w>screen.h;
  const menuPadTop=isMobile?(mobileLandscape?18:28):24;
  const menuPadBottom=isMobile?(mobileLandscape?44:56):28;
  const panelWidth=isMobile?(mobileLandscape?"min(100%, 780px)":"min(100%, 430px)"):"min(100%, 620px)";
  const utilityCompact=isMobile&&mobileLandscape;

  const leaveRoom=useCallback(async ()=>{
    if(roomSession){await roomSession.destroy();}
    setRoomSession(null);
    setMembers([]);
    setStatus("idle");
    setCopied(false);
    setRoomCodeInLocation("");
  },[roomSession]);

  useEffect(()=>{
    if(!initialRoomCode||roomSession||!hasOnlineConfig()||busy||autoJoinTried.current)return;
    autoJoinTried.current=true;
    launched.current=false;
    setBusy(true);
    setError("");
    const next=createRoomSession({roomCode:initialRoomCode,role:"guest"});
    next.connect()
      .then(()=>{
        setRoomSession(next);
        setStage("lobby");
        setRoomCodeInLocation(initialRoomCode);
      })
      .catch((err)=>{
        setError(err.message||"Could not join room.");
      })
      .finally(()=>setBusy(false));
  },[initialRoomCode,roomSession,busy]);

  useEffect(()=>{
    if(!roomSession)return;
    roomSession.setHandlers({
      onPresence:(next)=>setMembers(next),
      onStatus:(next)=>setStatus(next),
      onStart:(payload)=>{
        launched.current=true;
        onLaunch({session:roomSession,diff:payload?.diff||"normal",mapKey:payload?.mapKey||"classic",charIds:payload?.charIds||["bean","mocha"]});
      },
    });
    return ()=>roomSession.setHandlers({});
  },[roomSession,onLaunch]);

  useEffect(()=>()=>{if(!launched.current&&roomSession){roomSession.destroy();}},[roomSession]);

  const connectToRoom=useCallback(async (role)=>{
    if(!hasOnlineConfig()){
      setError("Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable online rooms.");
      return;
    }
    const roomCode=role==="host"?createRoomCode():normalizeRoomCode(joinCode);
    if(roomCode.length<6){
      setError("Enter a 6-character room code.");
      return;
    }
    setBusy(true);
    setError("");
    try{
      const next=createRoomSession({roomCode,role});
      await next.connect();
      setRoomSession(next);
      setStage("lobby");
      setRoomCodeInLocation(roomCode);
    }catch(err){
      setError(err.message||"Could not connect to the room.");
    }finally{
      setBusy(false);
    }
  },[joinCode]);

  const startOnlineGame=useCallback(()=>{
    if(!roomSession||roomSession.role!=="host"||members.length<2)return;
    launched.current=true;
    roomSession.sendStart({diff,mapKey,charIds:[p1Char,p2Char]}).catch(()=>{});
    onLaunch({session:roomSession,diff,mapKey,charIds:[p1Char,p2Char]});
  },[roomSession,members.length,diff,mapKey,onLaunch]);

  const copyInvite=useCallback(async ()=>{
    if(!roomSession)return;
    const value=roomSession.inviteLink||buildInviteLink(roomSession.roomCode);
    try{
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(()=>setCopied(false),1600);
    }catch(e){
      setError("Copy failed. You can still share the room code.");
    }
  },[roomSession]);

  const roomReady=members.length>=2;

  return (
    <div style={{position:"relative",width:"100%",height:"100%",overflow:"hidden",background:"radial-gradient(circle at top,#3a2215 0%,#1a0f08 55%,#120904 100%)",fontFamily:"'Silkscreen',monospace",color:"#f5e6d3"}}>
      <div style={{position:"absolute",inset:0,overflowY:"auto",WebkitOverflowScrolling:"touch",touchAction:"pan-y pinch-zoom"}}>
        <div style={{minHeight:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:isMobile?"flex-start":"center",paddingTop:`max(env(safe-area-inset-top), ${menuPadTop}px)`,paddingBottom:`max(env(safe-area-inset-bottom), ${menuPadBottom}px)`,paddingLeft:"max(env(safe-area-inset-left), 14px)",paddingRight:"max(env(safe-area-inset-right), 14px)"}}>
          <div style={{width:panelWidth,maxWidth:"100%",display:"flex",flexDirection:"column",alignItems:"center",gap:isMobile?(mobileLandscape?14:18):12,padding:isMobile?(mobileLandscape?"18px 16px 24px":"24px 18px 30px"):"24px 22px",background:isMobile?"linear-gradient(180deg,#120904ee 0%,#1a0f08dd 100%)":"transparent",border:isMobile?"1px solid #6b3a1f66":"none",borderRadius:isMobile?26:0,boxShadow:isMobile?"0 24px 48px #00000044,inset 0 1px 0 #ffffff08":"none",textAlign:"center"}}>
            <div style={{fontSize:isMobile?(mobileLandscape?30:34):24,color:P.gold,textShadow:`0 0 20px ${P.gold}44`}}>ONLINE SHIFT</div>
            <div style={{fontSize:isMobile?(mobileLandscape?11:12):9,color:"#c4956a",maxWidth:560,lineHeight:1.8}}>Host the game on Vercel or GitHub Pages, then share a Supabase room link or code so a friend can join. On phones, gameplay is best in landscape.</div>
            <ShellActionRow appShell={appShell} compact={utilityCompact} />
            <AudioToggleRow audioUi={audioUi} compact={utilityCompact} />
            {!hasOnlineConfig()&&<div style={{width:"100%",maxWidth:560,background:"#2d1b0e",border:"2px solid #6b3a1f",borderRadius:16,padding:isMobile?(mobileLandscape?"14px 16px":"18px 16px"):14,fontSize:isMobile?(mobileLandscape?11:12):9,lineHeight:1.8,color:"#e8a87c"}}>Online mode needs public realtime keys in <code>.env</code>: <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>.</div>}
            {error&&<div style={{color:P.red,fontSize:isMobile?(mobileLandscape?11:12):9,maxWidth:520,lineHeight:1.8}}>{error}</div>}

            {!roomSession?(
              <div style={{display:"flex",flexDirection:"column",gap:isMobile?14:12,alignItems:"center",width:"100%"}}>
                <button onClick={()=>connectToRoom("host")} disabled={busy||!hasOnlineConfig()} style={{fontFamily:"'Silkscreen',monospace",fontWeight:"bold",fontSize:isMobile?(mobileLandscape?16:18):13,padding:isMobile?(mobileLandscape?"16px 22px":"18px 24px"):"14px 22px",background:"#6b3a1f",color:"#f5e6d3",border:`2px solid ${P.gold}88`,borderRadius:14,cursor:"pointer",width:"100%",opacity:busy||!hasOnlineConfig()?0.5:1}}>CREATE ROOM</button>
                <div style={{display:"grid",gridTemplateColumns:isMobile&&mobileLandscape?"minmax(0,1fr) auto":"1fr",gap:10,width:"100%"}}>
                  <input value={joinCode} onChange={e=>setJoinCode(normalizeRoomCode(e.target.value))} placeholder="ROOM CODE" maxLength={6} style={{width:"100%",fontFamily:"'Silkscreen',monospace",fontSize:isMobile?(mobileLandscape?16:18):13,padding:isMobile?(mobileLandscape?"16px 18px":"18px 18px"):"14px 16px",borderRadius:14,border:"2px solid #6b3a1f",background:"#120904",color:"#f5e6d3",textTransform:"uppercase",textAlign:"center",letterSpacing:3}}/>
                  <button onClick={()=>connectToRoom("guest")} disabled={busy||!hasOnlineConfig()} style={{fontFamily:"'Silkscreen',monospace",fontWeight:"bold",fontSize:isMobile?(mobileLandscape?14:16):11,padding:isMobile?(mobileLandscape?"16px 18px":"18px 18px"):"14px 18px",background:"#2d1b0e",color:"#f5e6d3",border:`2px solid ${P.p1}88`,borderRadius:14,cursor:"pointer",opacity:busy||!hasOnlineConfig()?0.5:1,width:isMobile&&!mobileLandscape?"100%":undefined}}>JOIN</button>
                </div>
                <button onClick={onBack} style={{fontFamily:"'Silkscreen',monospace",fontWeight:"bold",fontSize:isMobile?(mobileLandscape?13:14):10,padding:isMobile?(mobileLandscape?"13px 18px":"14px 18px"):"10px 16px",background:"transparent",color:"#8a6a4a",border:"2px solid #3a2215",borderRadius:12,cursor:"pointer",width:isMobile?"100%":undefined}}>BACK</button>
              </div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:isMobile?14:12,alignItems:"center",width:"100%"}}>
                <div style={{background:"#2d1b0e",border:`2px solid ${P.gold}55`,borderRadius:18,padding:isMobile?(mobileLandscape?"16px 18px":"18px 18px"):16,width:"100%",display:"flex",flexDirection:"column",gap:10}}>
                  <div style={{fontSize:isMobile?(mobileLandscape?11:12):8,color:"#8a6a4a"}}>{roomSession.role==="host"?"HOSTING ROOM":"JOINED ROOM"}</div>
                  <div style={{fontSize:isMobile?(mobileLandscape?30:34):24,color:P.gold,letterSpacing:isMobile?5:6}}>{roomSession.roomCode}</div>
                  <div style={{fontSize:isMobile?(mobileLandscape?10:11):8,color:"#c4956a"}}>{members.length}/2 baristas connected</div>
                  <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
                    <button onClick={copyInvite} style={{fontFamily:"'Silkscreen',monospace",fontWeight:"bold",fontSize:isMobile?(mobileLandscape?12:13):10,padding:isMobile?(mobileLandscape?"11px 16px":"12px 16px"):"10px 14px",background:"#6b3a1f",color:"#f5e6d3",border:`2px solid ${P.gold}66`,borderRadius:12,cursor:"pointer"}}>{copied?"COPIED":"COPY INVITE"}</button>
                    <button onClick={async()=>{await leaveRoom();onBack();}} style={{fontFamily:"'Silkscreen',monospace",fontWeight:"bold",fontSize:isMobile?(mobileLandscape?12:13):10,padding:isMobile?(mobileLandscape?"11px 16px":"12px 16px"):"10px 14px",background:"transparent",color:"#8a6a4a",border:"2px solid #3a2215",borderRadius:12,cursor:"pointer"}}>LEAVE ROOM</button>
                  </div>
                </div>

                <div style={{display:"grid",gridTemplateColumns:isMobile&&mobileLandscape?"repeat(2, minmax(0, 1fr))":"1fr",gap:10,width:"100%"}}>
                  {[0,1].map((slot)=> {
                    const member=members.find((entry)=>entry.playerId===slot);
                    return <div key={slot} style={{background:"#1a0f08dd",border:`2px solid ${(slot===0?P.p1:P.p2)}55`,borderRadius:14,padding:isMobile?(mobileLandscape?"16px 14px":"16px 16px"):12}}>
                      <div style={{color:slot===0?P.p1:P.p2,fontSize:isMobile?(mobileLandscape?13:14):10}}>P{slot+1}</div>
                      <div style={{color:member?"#f5e6d3":"#8a6a4a",fontSize:isMobile?(mobileLandscape?11:12):9,marginTop:8}}>{member?member.role.toUpperCase():"WAITING..."}</div>
                    </div>;
                  })}
                </div>

                {roomSession.role==="host"?(
                  <div style={{display:"flex",flexDirection:"column",gap:10,alignItems:"center",width:"100%"}}>
                    <div style={{fontSize:isMobile?(mobileLandscape?12:13):10,color:"#c4956a"}}>Choose the difficulty for this room</div>
                    <div style={{display:"grid",gridTemplateColumns:isMobile?(mobileLandscape?"repeat(3, minmax(0, 1fr))":"1fr"):"repeat(3, minmax(0, 1fr))",gap:8,width:"100%"}}>
                      {Object.entries(DIFF).map(([key,entry])=><button key={key} onClick={()=>setDiff(key)} style={{fontFamily:"'Silkscreen',monospace",fontWeight:"bold",fontSize:isMobile?(mobileLandscape?11:12):9,padding:isMobile?(mobileLandscape?"14px 10px":"14px 14px"):"10px 12px",background:diff===key?`${entry.clr}22`:"#2d1b0e",color:entry.clr,border:`2px solid ${diff===key?entry.clr:entry.clr+"55"}`,borderRadius:12,cursor:"pointer",width:"100%"}}>{entry.label}</button>)}
                    </div>
                    <div style={{fontSize:isMobile?(mobileLandscape?12:13):10,color:"#c4956a",marginTop:4}}>Choose the floor plan for this room</div>
                    <MapChoiceGrid selected={mapKey} onSelect={setMapKey} isMobile={isMobile} compact={isMobile} />
                    <div style={{fontSize:isMobile?(mobileLandscape?12:13):10,color:"#c4956a",marginTop:4}}>Choose your baristas:</div>
                    <CharacterSelectGrid p1Char={p1Char} p2Char={p2Char} onSelectP1={setP1Char} onSelectP2={setP2Char} playerCount={2} isMobile={isMobile} />
                    <button onClick={startOnlineGame} disabled={!roomReady} style={{fontFamily:"'Silkscreen',monospace",fontWeight:"bold",fontSize:isMobile?(mobileLandscape?16:18):13,padding:isMobile?(mobileLandscape?"16px 20px":"18px 24px"):"14px 22px",background:roomReady?"#6b3a1f":"#3a2215",color:roomReady?"#f5e6d3":"#8a6a4a",border:`2px solid ${roomReady?P.gold+"88":"#5a3a20"}`,borderRadius:14,cursor:roomReady?"pointer":"not-allowed",width:"100%"}}>START ONLINE SHIFT</button>
                    {!roomReady&&<div style={{fontSize:isMobile?(mobileLandscape?10:11):8,color:"#8a6a4a",lineHeight:1.8}}>Share the link or room code and wait for player 2.</div>}
                  </div>
                ):(
                  <div style={{fontSize:isMobile?(mobileLandscape?12:13):10,color:roomReady?P.green:"#c4956a",lineHeight:1.8}}>{roomReady?"Host can start any time.":"Waiting for the host to start the shift..."}</div>
                )}

                <div style={{fontSize:isMobile?(mobileLandscape?10:11):8,color:"#6b3a1f"}}>Realtime status: {status}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
function GameOver({score,diff,onRestart,isMobile}){
  const thresholds=diff==="chill"?[300,150,50]:diff==="hectic"?[500,250,100]:[400,200,80];
  const r=score>=thresholds[0]?{s:"S",t:"MASTER BARISTA!",c:P.gold}
    :score>=thresholds[1]?{s:"A",t:"Great shift!",c:P.orange}
    :score>=thresholds[2]?{s:"B",t:"Not bad, rookie!",c:"#c4956a"}
    :{s:"C",t:"Rough day...",c:"#8a6a4a"};
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",background:"linear-gradient(180deg,#1a0f08 0%,#2d1b0e 50%,#1a0f08 100%)",fontFamily:"'Silkscreen',monospace",color:"#f5e6d3",gap:isMobile?16:12,padding:20,textAlign:"center"}}>
      <div style={{fontSize:isMobile?28:24,color:P.gold,textShadow:`0 0 20px ${P.gold}44`}}>SHIFT OVER!</div>
      <div style={{fontSize:isMobile?56:48,color:P.gold,fontWeight:"bold",textShadow:`0 0 30px ${P.gold}66, 0 4px 0 #8b6914`,animation:"scoreReveal .5s ease-out"}}>{score}</div>
      <div style={{fontSize:isMobile?12:10,color:"#c4956a"}}>POINTS EARNED</div>
      <div style={{fontSize:isMobile?36:28,animation:"starBounce .6s ease-out .3s both"}}>{r.s}</div>
      <div style={{fontSize:isMobile?16:14,color:r.c,fontWeight:"bold"}}>{r.t}</div>
      <div style={{marginTop:20}}>
        <button onClick={onRestart} style={{fontFamily:"'Silkscreen',monospace",fontWeight:"bold",fontSize:isMobile?16:14,padding:isMobile?"18px 40px":"14px 32px",background:"#6b3a1f",color:"#f5e6d3",border:`2px solid ${P.gold}88`,borderRadius:10,cursor:"pointer",boxShadow:"0 4px 16px #00000044"}}>PLAY AGAIN</button>
      </div>
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// APP
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
export default function CafeChaos(){
  const initialRoomCode=getRoomCodeFromLocation();
  const[screen,setScreen]=useState(initialRoomCode?"online":"title");const[pCount,setPc]=useState(1);
  const[diff,setDiff]=useState("normal");const[mapKey,setMapKey]=useState("classic");const[finalScore,setFs]=useState(0);
  const[tutorialKey,setTutorialKey]=useState(null);
  const[completedTraining,setCompletedTraining]=useState([]);
  const[trainingNotice,setTrainingNotice]=useState("");
  const[onlineSession,setOnlineSession]=useState(null);
  const[gameKey,setGameKey]=useState(0);
  const appShell=useShellActions();
  const[audioPrefs,setAudioPrefs]=useState(()=>loadAudioPrefs());
  const autoMobile = useIsMobile();
  const[forceMode,setForceMode]=useState(null); // null=auto, "mobile", "pc"
  const isMobile = forceMode === "mobile" ? true : forceMode === "pc" ? false : autoMobile;

  useEffect(()=>{
    sfx.setPrefs(audioPrefs);
    try{window.localStorage.setItem(AUDIO_PREFS_KEY,JSON.stringify(audioPrefs));}catch(e){}
  },[audioPrefs]);

  useEffect(()=>{
    sfx.setMusicMode(screen==="game"||screen==="tutorial"?"gameplay":"menu");
  },[screen]);

  useEffect(()=>{
    const unlock=()=>sfx.init();
    window.addEventListener("pointerdown",unlock,{once:true});
    window.addEventListener("keydown",unlock,{once:true});
    return ()=>{
      window.removeEventListener("pointerdown",unlock);
      window.removeEventListener("keydown",unlock);
    };
  },[]);

  const audioUi={
    prefs:audioPrefs,
    hasMusic:sfx.hasMusic(),
    hasMultipleTracks:sfx.musicCount()>1,
    toggleMusic:()=>{sfx.init();setAudioPrefs((p)=>({...p,music:!p.music}));},
    toggleSfx:()=>{sfx.init();setAudioPrefs((p)=>({...p,sfx:!p.sfx}));},
    nextTrack:()=>{sfx.init();sfx.nextTrack();},
  };

  const returnToTitle=useCallback(()=>{
    if(onlineSession){onlineSession.destroy().catch(()=>{});}
    setOnlineSession(null);
    setTutorialKey(null);
    setRoomCodeInLocation("");
    setScreen("title");
  },[onlineSession]);

  const[charIds,setCharIds]=useState(["bean","mocha"]);
  const startLocalGame=useCallback((n,d,nextMapKey="classic",c1="bean",c2="mocha")=>{
    if(onlineSession){onlineSession.destroy().catch(()=>{});}
    setOnlineSession(null);
    setTutorialKey(null);
    setPc(n);
    setDiff(d);
    setMapKey(nextMapKey);
    setCharIds([c1,c2]);
    setGameKey((key)=>key+1);
    setScreen("game");
  },[onlineSession]);

  const startOnlineGame=useCallback(({session,diff:nextDiff,mapKey:nextMapKey="classic",charIds:nextCharIds})=>{
    setTutorialKey(null);
    setOnlineSession(session);
    setPc(2);
    setDiff(nextDiff);
    setMapKey(nextMapKey);
    if(nextCharIds)setCharIds(nextCharIds);
    setGameKey((key)=>key+1);
    setScreen("game");
  },[]);

  const startTutorial=useCallback((trackId)=>{
    if(onlineSession){onlineSession.destroy().catch(()=>{});}
    const track=TRAINING_TRACKS[trackId];
    if(!track)return;
    setOnlineSession(null);
    setTutorialKey(trackId);
    setTrainingNotice("");
    setPc(1);
    setDiff("chill");
    setMapKey(track.mapKey||"classic");
    setGameKey((key)=>key+1);
    setScreen("tutorial");
  },[onlineSession]);

  const completeTutorial=useCallback((trackId)=>{
    const track=TRAINING_TRACKS[trackId];
    setCompletedTraining((prev)=>prev.includes(trackId)?prev:[...prev,trackId]);
    setTrainingNotice(track?`${track.title} complete!`:"Lesson complete!");
    setScreen("training");
  },[]);

  return (
    <div style={{width:"100vw",height:"100dvh",minHeight:"100vh",overflow:"hidden",background:P.bg,position:"fixed",inset:0,touchAction:screen==="game"||screen==="tutorial"?"none":"auto"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&family=Silkscreen:wght@400;700&display=swap');
        @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
        @keyframes scoreReveal{from{transform:scale(.5);opacity:0}to{transform:scale(1);opacity:1}}
        @keyframes starBounce{0%{transform:scale(0)}50%{transform:scale(1.3)}100%{transform:scale(1)}}
        @keyframes catBubbleIn{from{opacity:0;transform:translateY(-6px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;}
        html,body,#root{width:100%;height:100%;margin:0;padding:0;background:#1a0f08;overflow:hidden;}
        body{overscroll-behavior:none;}
      `}</style>
      {screen==="title"&&<TitleScreen audioUi={audioUi} appShell={appShell} isMobile={isMobile} forceMode={forceMode} setForceMode={setForceMode} initialMapKey={mapKey} onStart={startLocalGame} onOpenOnline={()=>setScreen("online")} onOpenTraining={()=>setScreen("training")}/>}
      {screen==="training"&&<TutorialHubScreen audioUi={audioUi} appShell={appShell} isMobile={isMobile} completedIds={completedTraining} notice={trainingNotice} onBack={returnToTitle} onStartTutorial={startTutorial}/>}
      {screen==="online"&&<OnlineRoomScreen audioUi={audioUi} appShell={appShell} isMobile={isMobile} initialMapKey={mapKey} initialRoomCode={initialRoomCode} onBack={returnToTitle} onLaunch={startOnlineGame}/>}
      {screen==="game"&&<Game key={gameKey} audioUi={audioUi} appShell={appShell} playerCount={pCount} diff={diff} mapKey={mapKey} charIds={charIds} isMobile={isMobile} onlineSession={onlineSession} onEnd={s=>{setFs(s);setScreen("over");}}/>}
      {screen==="tutorial"&&tutorialKey&&<Game key={gameKey} audioUi={audioUi} appShell={appShell} playerCount={1} diff="chill" mapKey={mapKey} charIds={charIds} isMobile={isMobile} tutorialTrack={tutorialKey} onTutorialExit={()=>setScreen("training")} onTutorialComplete={completeTutorial} onEnd={()=>setScreen("training")} />}
      {screen==="over"&&<GameOver score={finalScore} diff={diff} isMobile={isMobile} onRestart={returnToTitle}/>}
      <InstallHelpModal appShell={appShell} />
    </div>
  );
}

