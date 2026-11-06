import {
  BADGES,
  buildGrid,
  canPlace,
  DOOR_TILE,
  findPath,
  DEFAULT_LOOK,
  footprint,
  furniture,
  FURNITURE,
  FURNITURE_TYPES,
  QUESTS,
  ROOM_SIZE,
  RUN_MULTIPLIER,
  sellPrice,
  WALK_SPEED,
  type FriendView,
  type FurnitureType,
  type Look,
  type Me,
  type NavigatorRoom,
  type PlacedItem,
  type ProfileView,
  type RoomView,
  type ServerMsg,
} from '@hutel/shared';
import { Actor } from './actors';
import {
  accessToken,
  isAuthRedirect,
  loadConfig,
  signInWithEmail,
  signInWithProvider,
  signOut,
  type AuthConfig,
} from './auth';
import { buildFurniture } from './gfx/furniture';
import { T, tw } from './gfx/helpers';
import { createRoom } from './gfx/room';
import { createStage } from './gfx/scene';
import { Net } from './net';
import { $, COIN, confetti, setCoinText, esc, logLine, lookEditor, pop, toast } from './ui';

const envServer = (import.meta.env.VITE_SERVER_URL as string | undefined) || '';
// Dev (Vite on :5173) talks to the server on :2567; in production the server serves the client itself.
const SERVER =
  envServer ||
  (location.port === '5173' ? `${location.protocol}//${location.hostname}:2567` : location.origin);
const WS_URL = SERVER.replace(/^http/, 'ws') + '/ws';
const TOKEN_KEY = 'hutel-token';
const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string | null) => {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      /* private mode */
    }
  },
};

/* ---------------- scene ---------------- */
const stage = createStage($('app'));
const roomGfx = createRoom(stage.scene);
const furnRoot = new T.Group();
stage.scene.add(furnRoot);
const overlay = $('overlay');
const cv = stage.renderer.domElement;

const hoverM = new T.Mesh(
  new T.PlaneGeometry(0.92, 0.92),
  new T.MeshBasicMaterial({ color: 0xfff3d6, transparent: true, opacity: 0.28, depthWrite: false }),
);
hoverM.rotation.x = -Math.PI / 2;
hoverM.visible = false;
stage.scene.add(hoverM);
const placeM = new T.Mesh(
  new T.PlaneGeometry(1, 1),
  new T.MeshBasicMaterial({ color: 0x6fd36f, transparent: true, opacity: 0.42, depthWrite: false }),
);
placeM.rotation.x = -Math.PI / 2;
placeM.visible = false;
stage.scene.add(placeM);
const gridHelper = new T.GridHelper(ROOM_SIZE, ROOM_SIZE, 0xfff0d0, 0xfff0d0);
gridHelper.position.y = 0.006;
(gridHelper.material as T.Material).transparent = true;
(gridHelper.material as T.Material).opacity = 0.28;
gridHelper.visible = false;
stage.scene.add(gridHelper);

/* ---------------- state ---------------- */
let net: Net | null = null;
let me: Me | null = null;
let room: RoomView | null = null;
const items = new Map<number, PlacedItem>();
const objs = new Map<number, T.Group>();
const actors = new Map<string, Actor>();
let friends: FriendView[] = [];
let requests: { id: string; name: string }[] = [];
let build = false;
let held: { item: PlacedItem; isNew: boolean; orig?: PlacedItem } | null = null;
let running = false;
const keys = new Set<string>();
let panelKind: string | null = null;
let onboardingLock = true;

const myActor = () => (me ? actors.get(me.id) : undefined);

/* Client-side prediction: our own figure starts walking at once, and the server's echo of
   the same walk is ignored. If the server disagrees (blocked, seat, etc.) its path wins. */
const pending: { goal: string; at: number }[] = [];
function expectEcho(goal: [number, number]) {
  const now = performance.now();
  while (pending.length && now - pending[0]!.at > 2500) pending.shift();
  pending.push({ goal: goal.join(), at: now });
}
function isOwnEcho(goal: [number, number]) {
  const i = pending.findIndex((p) => p.goal === goal.join());
  if (i < 0) return false;
  pending.splice(0, i + 1);
  return true;
}
function predictWalk(goal: [number, number], run: boolean) {
  const a = myActor();
  if (!a || !net || a.seatId !== null) return;
  const now = net.now();
  const next = a.heading(now);
  const grid = buildGrid(ROOM_SIZE, [...items.values()]);
  const found = findPath(grid, next, goal);
  const rest = found?.map(([x, z]): [number, number] => [x, z]);
  if (!rest) return;
  const here: [number, number] = [a.x, a.z];
  const atNext = Math.hypot(next[0] - a.x, next[1] - a.z) < 0.01;
  a.setPath(atNext ? next : here, atNext ? rest : [next, ...rest], now, run, null);
  expectEcho(goal);
}
const onboarded = () => !!me && (!onboardingLock || QUESTS.every((q) => me!.quests.includes(q.id)));
const questsDone = () => !!me && QUESTS.every((q) => me!.quests.includes(q.id));
const isOwner = () => !!me && !!room && room.ownerId === me.id;

/* ---------------- bubbles ---------------- */
interface Bubble {
  el: HTMLDivElement;
  who: string;
  born: number;
  off: number;
}
const bubbles: Bubble[] = [];
function bubble(id: string, name: string, text: string, whisper = false) {
  for (const b of bubbles) if (b.who === id) b.off += (b.el.offsetHeight || 30) + 6;
  const el = document.createElement('div');
  el.className = 'bubble' + (whisper ? ' whisper' : '');
  const b = document.createElement('b');
  b.textContent = name + ':';
  el.append(b, document.createTextNode(text));
  overlay.appendChild(el);
  bubbles.push({ el, who: id, born: performance.now(), off: 0 });
}

/* ---------------- furniture objects ---------------- */
function placeObj(it: PlacedItem, lift = 0) {
  let g = objs.get(it.id);
  if (!g || g.userData.type !== it.type) {
    if (g) furnRoot.remove(g);
    g = buildFurniture(it.type, it.id);
    g.userData.type = it.type;
    furnRoot.add(g);
    objs.set(it.id, g);
  }
  const f = footprint(it);
  g.position.set(tw(it.x) + (f.w - 1) / 2, lift, tw(it.z) + (f.d - 1) / 2);
  g.rotation.y = (it.rot * Math.PI) / 2;
  return g;
}
function removeObj(id: number) {
  const g = objs.get(id);
  if (g) furnRoot.remove(g);
  objs.delete(id);
}

/* ---------------- room ---------------- */
function setRoom(view: RoomView) {
  cancelHeld();
  setBuild(false);
  room = view;
  for (const a of actors.values()) a.dispose(stage.scene);
  actors.clear();
  for (const b of bubbles) b.el.remove();
  bubbles.length = 0;
  for (const id of [...objs.keys()]) removeObj(id);
  items.clear();
  roomGfx.setTheme(view.theme);
  for (const it of view.items) {
    items.set(it.id, it);
    placeObj(it);
  }
  for (const p of view.players)
    actors.set(p.id, new Actor(p, stage.scene, overlay, p.id === me?.id));
  updateRoomUi();
  logLine({ text: `*** Du er i ${view.name}`, cls: 'sys' });
  roomGfx.openDoor(false);
  setTimeout(() => $('fade').classList.remove('on'), 120);
}

function updateRoomUi() {
  if (!room || !me) return;
  $('roomName').textContent = room.ownerName
    ? `${room.name} · ${room.ownerName}`
    : `${room.name} · Hutel.dk`;
  $<HTMLButtonElement>('bBuild').disabled = !room.canBuild;
  $<HTMLButtonElement>('bShop').disabled = !isOwner();
  roomGfx.setDoorUnlocked(onboarded());
  const showQuests = !questsDone() && room.id === me.homeRoomId;
  $('quests').classList.toggle('hidden', !showQuests);
  renderQuests();
}

function goTo(roomId: string, password?: string) {
  if (room?.id === roomId) return closePanel();
  closePanel();
  roomGfx.openDoor(true);
  $('fade').classList.add('on');
  setTimeout(() => net?.send({ t: 'join', roomId, password }), 350);
  setTimeout(() => $('fade').classList.remove('on'), 2500);
}

/* ---------------- quests / coins ---------------- */
function renderQuests() {
  if (!me) return;
  $('qlist').innerHTML = QUESTS.map((q) => {
    const done = me!.quests.includes(q.id);
    return `<li class="${done ? 'done' : ''}"><span>${done ? '✅' : '⬜'}</span><span class="t">${esc(q.text)}</span><span class="r">+${q.reward} ${COIN}</span></li>`;
  }).join('');
  $('qCount').textContent = `${me.quests.length}/${QUESTS.length}`;
}
function setCoins(c: number) {
  if (!me) return;
  me.coins = c;
  setCoinText($('coinVal'), `🪙 ${c}`);
  if (panelKind === 'shop') renderShop();
}
function setOnline(sec: number) {
  if (!me) return;
  me.onlineSec = sec;
  setCoinText(
    $('online'),
    innerWidth < 760
      ? `⏱ ${Math.floor(sec / 60)} min · +1/min`
      : `⏱ Online ${Math.floor(sec / 60)} min · +1 🪙 pr. minut`,
  );
}

/* ---------------- server messages ---------------- */
function handle(msg: ServerMsg) {
  switch (msg.t) {
    case 'welcome':
      me = msg.me;
      onboardingLock = msg.onboardingLock;
      setCoins(me.coins);
      setOnline(me.onlineSec);
      $('signup').classList.add('hidden');
      return;
    case 'room':
      return setRoom(msg.room);
    case 'playerJoin':
      if (!actors.has(msg.player.id))
        actors.set(msg.player.id, new Actor(msg.player, stage.scene, overlay, false));
      if (!msg.player.bot) logLine({ text: `*** ${msg.player.name} kom ind`, cls: 'sys' });
      return;
    case 'playerLeave': {
      const a = actors.get(msg.id);
      if (a) {
        if (!a.view.bot) logLine({ text: `*** ${a.view.name} gik`, cls: 'sys' });
        a.dispose(stage.scene);
        actors.delete(msg.id);
      }
      return;
    }
    case 'path': {
      if (msg.id === me?.id && msg.glide) return; // our own arrow-key walk
      if (msg.id === me?.id && msg.seatId === null) {
        const last = msg.path[msg.path.length - 1] ?? msg.from;
        if (isOwnEcho([last[0], last[1]])) return;
      }
      actors.get(msg.id)?.setPath(msg.from, msg.path, msg.pathStart, msg.run, msg.seatId);
      return;
    }
    case 'chat':
      bubble(msg.id, (msg.bot ? '🤖 ' : '') + msg.name, msg.text);
      logLine({ name: (msg.bot ? '🤖 ' : '') + msg.name, text: msg.text });
      return;
    case 'whisper': {
      const mine = msg.from === me?.id;
      const other = mine ? (friends.find((f) => f.id === msg.to)?.name ?? '?') : msg.fromName;
      logLine({
        name: mine ? `Privat til ${other}` : `Privat fra ${other}`,
        text: msg.text,
        cls: 'pm',
      });
      if (actors.has(msg.from)) bubble(msg.from, msg.fromName + ' (privat)', msg.text, true);
      return;
    }
    case 'action':
      actors.get(msg.id)?.setAction(msg.kind);
      return;
    case 'look':
      actors.get(msg.id)?.setLook(msg.look);
      if (me && msg.id === me.id) me.look = msg.look;
      return;
    case 'itemPut':
      items.set(msg.item.id, msg.item);
      if (held?.item.id !== msg.item.id) placeObj(msg.item);
      return;
    case 'itemRemove':
      items.delete(msg.id);
      removeObj(msg.id);
      return;
    case 'roomMeta':
      if (room)
        Object.assign(room, { name: msg.name, description: msg.description, access: msg.access });
      return updateRoomUi();
    case 'coins': {
      const diff = me ? msg.coins - me.coins : 0;
      setCoins(msg.coins);
      if (diff > 0) pop(`+${diff} 🪙`);
      return;
    }
    case 'online':
      return setOnline(msg.onlineSec);
    case 'quest': {
      if (!me) return;
      if (!me.quests.includes(msg.id)) me.quests.push(msg.id);
      const q = QUESTS.find((x) => x.id === msg.id)!;
      toast(`✅ ${q.text} · +${msg.reward} 🪙`);
      renderQuests();
      if (msg.all)
        setTimeout(() => {
          confetti();
          toast('🎉 Alle startopgaver klaret! Døren er åben – klik på den for at se hotellet 🚪');
          $('quests').classList.add('gone');
          setTimeout(() => updateRoomUi(), 900);
        }, 1200);
      return;
    }
    case 'badge':
      me?.badges.push(msg.id);
      return toast(`${BADGES[msg.id].icon} Nyt badge: ${BADGES[msg.id].name}`);
    case 'friends':
      friends = msg.friends;
      requests = msg.requests;
      $('reqDot').classList.toggle('hidden', !requests.length);
      if (panelKind === 'friends') renderFriends();
      return;
    case 'navigator':
      if (panelKind === 'nav') renderNavigator(msg.rooms);
      return;
    case 'profile':
      return renderProfile(msg.profile);
    case 'toast':
      $('fade').classList.remove('on');
      roomGfx.openDoor(false);
      return toast(msg.text, msg.kind);
    case 'needPassword':
      $('fade').classList.remove('on');
      roomGfx.openDoor(false);
      return renderPassword(msg.roomId);
    case 'pong':
      return;
  }
}

/* ---------------- panels ---------------- */
function openPanel(kind: string, html: string) {
  panelKind = kind;
  const p = $('panel');
  p.innerHTML = html;
  p.classList.remove('hidden');
  p.querySelector('[data-close]')?.addEventListener('click', closePanel);
  for (const id of ['bNav', 'bFriends', 'bFig', 'bShop']) $(id).classList.remove('on');
  const btn = { nav: 'bNav', friends: 'bFriends', fig: 'bFig', shop: 'bShop' }[kind];
  if (btn) $(btn).classList.add('on');
}
function closePanel() {
  panelKind = null;
  $('panel').classList.add('hidden');
  for (const id of ['bNav', 'bFriends', 'bFig', 'bShop']) $(id).classList.remove('on');
}
const head = (title: string, sub = '') =>
  `<h2>${title} <button class="x" data-close>✕</button></h2>${sub ? `<p class="sub">${sub}</p>` : ''}`;
const toggle = (kind: string, open: () => void) => () =>
  panelKind === kind ? closePanel() : open();

function openNavigator() {
  openPanel(
    'nav',
    head('🧭 Navigator', 'Gå på opdagelse i hotellet.') + '<p class="sub">Henter rum…</p>',
  );
  net?.send({ t: 'navigator' });
}
function renderNavigator(rooms: NavigatorRoom[]) {
  const row = (r: NavigatorRoom) =>
    `<div class="li"><div class="grow"><b>${esc(r.name)}</b>${r.access !== 'open' ? (r.access === 'locked' ? ' 🔒' : ' 🔑') : ''}<small>${esc(r.description || (r.ownerName ? `Af ${r.ownerName}` : ''))}</small></div><span class="users">👤 ${r.users}</span><button class="small" data-go="${esc(r.id)}">${room?.id === r.id ? 'Her' : 'Gå'}</button></div>`;
  const pub = rooms.filter((r) => r.public);
  const guest = rooms.filter((r) => !r.public);
  const own =
    isOwner() && room
      ? `<h3>Dit værelse</h3><div class="row"><input id="rsName" maxlength="30" value="${esc(room.name)}" style="width:100%"></div>
       <div class="row"><input id="rsDesc" maxlength="80" placeholder="Beskrivelse" value="${esc(room.description)}" style="width:100%"></div>
       <div class="row" style="display:flex;gap:6px;flex-wrap:wrap"><select id="rsAccess"><option value="open">Åbent for alle</option><option value="locked">Låst</option><option value="password">Adgangskode</option></select>
       <input id="rsPw" type="password" maxlength="40" placeholder="Ny adgangskode"><button id="rsSave" class="small primary">Gem</button></div>`
      : '';
  openPanel(
    'nav',
    head('🧭 Navigator', 'Gå på opdagelse i hotellet.') +
      `<h3>Offentlige rum</h3><div class="list">${pub.map(row).join('')}</div>` +
      `<h3>Værelser</h3><div class="list">${guest.map(row).join('') || '<p class="sub">Ingen værelser med gæster lige nu.</p>'}</div>` +
      own,
  );
  $('panel')
    .querySelectorAll<HTMLElement>('[data-go]')
    .forEach((b) => b.addEventListener('click', () => goTo(b.dataset.go!)));
  if (own && room) {
    $<HTMLSelectElement>('rsAccess').value = room.access;
    $('rsSave').addEventListener('click', () => {
      const pw = $<HTMLInputElement>('rsPw').value;
      net?.send({
        t: 'roomSettings',
        name: $<HTMLInputElement>('rsName').value.trim() || undefined,
        description: $<HTMLInputElement>('rsDesc').value,
        access: $<HTMLSelectElement>('rsAccess').value as RoomView['access'],
        password: pw.length >= 3 ? pw : undefined,
      });
    });
  }
}

function renderShop() {
  if (!me) return;
  const list = FURNITURE_TYPES.filter((k) => !furniture(k).noShop);
  openPanel(
    'shop',
    head(
      '🛒 Møbelbutikken',
      'Køb med mønter. Møblet ryger direkte ind på dit værelse, hvor du placerer det.',
    ) +
      `<div class="grid">${list
        .map((k) => {
          const c = FURNITURE[k];
          return `<div class="item"><div class="ic">${c.icon}</div><div class="n">${c.name}</div><div class="p">${c.price} ${COIN} · ${c.w}×${c.d}</div><button data-buy="${k}" ${me!.coins < c.price ? 'disabled' : ''}>Køb</button></div>`;
        })
        .join('')}</div>`,
  );
  $('panel')
    .querySelectorAll<HTMLElement>('[data-buy]')
    .forEach((b) => b.addEventListener('click', () => startBuy(b.dataset.buy as FurnitureType)));
}

function renderFigure() {
  if (!me) return;
  openPanel(
    'fig',
    head('🧍 Min figur') +
      `<div class="row"><label>Motto</label><input id="motto" maxlength="60" value="${esc(me.motto)}" style="width:100%"></div><div id="lookEd"></div>
    <h3>Mine badges</h3><div class="badges">${me.badges.map((b) => `<span class="badge">${BADGES[b].icon} ${BADGES[b].name}</span>`).join('')}</div>
    <h3>Konto</h3><button id="logout" class="small danger">Log ud på denne enhed</button>`,
  );
  let lookT: number | undefined;
  lookEditor($('lookEd'), me.look, (look) => {
    me!.look = look;
    myActor()?.setLook(look);
    clearTimeout(lookT);
    lookT = window.setTimeout(() => net?.send({ t: 'look', look }), 250);
  });
  $('motto').addEventListener('change', (e) => {
    me!.motto = (e.target as HTMLInputElement).value;
    net?.send({ t: 'motto', motto: me!.motto });
  });
  $('logout').addEventListener('click', () => {
    store.set(TOKEN_KEY, null);
    void signOut(authCfg).finally(() => location.reload());
  });
}

function renderFriends() {
  openPanel(
    'friends',
    head('👥 Venner') +
      `<div class="row" style="display:flex;gap:6px"><input id="frName" maxlength="16" placeholder="Navn på en gæst" style="flex:1"><button id="frAdd" class="small primary">Tilføj</button></div>` +
      (requests.length
        ? `<h3>Venneanmodninger</h3><div class="list">${requests.map((r) => `<div class="li"><div class="grow"><b>${esc(r.name)}</b></div><button class="small primary" data-acc="${r.id}">Ja</button><button class="small" data-dec="${r.id}">Nej</button></div>`).join('')}</div>`
        : '') +
      `<h3>Dine venner</h3><div class="list">${friends.map((f) => `<div class="li"><div class="grow"><b>${esc(f.name)}</b><small>${f.online ? `<span class="status-on">● Online</span>${f.roomName ? ' · ' + esc(f.roomName) : ''}` : 'Offline'}</small></div>${f.online && f.roomId ? `<button class="small" data-go="${esc(f.roomId)}">Gå til</button>` : ''}<button class="small" data-pm="${esc(f.name)}">Skriv</button></div>`).join('') || '<p class="sub">Ingen venner endnu – klik på en figur for at tilføje.</p>'}</div>`,
  );
  const p = $('panel');
  $('frAdd').addEventListener('click', () => {
    const n = $<HTMLInputElement>('frName').value.trim();
    if (n.length >= 2) net?.send({ t: 'friendRequest', name: n });
  });
  p.querySelectorAll<HTMLElement>('[data-acc]').forEach((b) =>
    b.addEventListener('click', () =>
      net?.send({ t: 'friendRespond', userId: b.dataset.acc!, accept: true }),
    ),
  );
  p.querySelectorAll<HTMLElement>('[data-dec]').forEach((b) =>
    b.addEventListener('click', () =>
      net?.send({ t: 'friendRespond', userId: b.dataset.dec!, accept: false }),
    ),
  );
  p.querySelectorAll<HTMLElement>('[data-go]').forEach((b) =>
    b.addEventListener('click', () => goTo(b.dataset.go!)),
  );
  p.querySelectorAll<HTMLElement>('[data-pm]').forEach((b) =>
    b.addEventListener('click', () => {
      closePanel();
      const inp = $<HTMLInputElement>('chatIn');
      inp.value = `/w ${b.dataset.pm} `;
      inp.focus();
    }),
  );
}

function renderProfile(p: ProfileView) {
  const self = p.id === me?.id;
  const inMyRoom = isOwner() && !self && !p.bot;
  openPanel(
    'profile',
    head(
      `${p.bot ? '🤖 ' : ''}${esc(p.name)}`,
      p.bot
        ? 'AI-beboer på Hutel. Svarene er skrevet af en AI.'
        : p.since
          ? `Gæst siden ${p.since}`
          : '',
    ) +
      (p.motto ? `<p>“${esc(p.motto)}”</p>` : '') +
      (p.badges.length
        ? `<div class="badges">${p.badges.map((b) => `<span class="badge">${BADGES[b].icon} ${BADGES[b].name}</span>`).join('')}</div>`
        : '') +
      (!self && !p.bot
        ? `<div class="chips" style="margin-top:12px">
          ${p.friend ? `<button data-a="pm">💬 Skriv privat</button><button data-a="unfriend">Fjern ven</button>` : `<button data-a="friend" class="primary">➕ Tilføj ven</button>`}
          ${inMyRoom ? `<button data-a="rights">🔨 Giv byggerettigheder</button><button data-a="norights">Fjern rettigheder</button>` : ''}
          <button data-a="block">${p.blocked ? 'Fjern blokering' : '🚫 Blokér'}</button><button data-a="report" class="danger">⚠️ Rapportér</button></div>
         <div id="repBox" class="hidden" style="margin-top:10px"><textarea id="repText" rows="3" maxlength="300" placeholder="Hvad skete der?" style="width:100%"></textarea><button id="repSend" class="small danger">Send rapport</button></div>`
        : ''),
  );
  $('panel')
    .querySelectorAll<HTMLElement>('[data-a]')
    .forEach((b) =>
      b.addEventListener('click', () => {
        const a = b.dataset.a;
        if (a === 'friend') net?.send({ t: 'friendRequest', name: p.name });
        if (a === 'unfriend') net?.send({ t: 'friendRemove', userId: p.id });
        if (a === 'rights') net?.send({ t: 'rights', userId: p.id, grant: true });
        if (a === 'norights') net?.send({ t: 'rights', userId: p.id, grant: false });
        if (a === 'block') net?.send({ t: 'block', userId: p.id, block: !p.blocked });
        if (a === 'pm') {
          closePanel();
          $<HTMLInputElement>('chatIn').value = `/w ${p.name} `;
          $('chatIn').focus();
        }
        if (a === 'report') $('repBox').classList.remove('hidden');
        if (a !== 'report' && a !== 'pm')
          setTimeout(() => net?.send({ t: 'profile', userId: p.id }), 300);
      }),
    );
  $('repSend')?.addEventListener('click', () => {
    const r = $<HTMLTextAreaElement>('repText').value.trim();
    if (r.length >= 3) {
      net?.send({ t: 'report', userId: p.id, reason: r });
      closePanel();
    }
  });
}

function renderPassword(roomId: string) {
  openPanel(
    'pw',
    head('🔑 Adgangskode', 'Værelset er beskyttet med en adgangskode.') +
      `<div style="display:flex;gap:6px"><input id="pwIn" type="password" maxlength="40" style="flex:1"><button id="pwGo" class="primary">Gå ind</button></div>`,
  );
  const go = () => goTo(roomId, $<HTMLInputElement>('pwIn').value);
  $('pwGo').addEventListener('click', go);
  $('pwIn').addEventListener('keydown', (e) => e.key === 'Enter' && go());
  $('pwIn').focus();
}

/* ---------------- building ---------------- */
function setBuild(on: boolean) {
  if (!on) cancelHeld();
  build = on && !!room?.canBuild;
  gridHelper.visible = build;
  $('bBuild').classList.toggle('on', build);
  hoverM.visible = false;
  updateBuildbar();
}
function updateBuildbar() {
  $('buildbar').classList.toggle('hidden', !build);
  const h = !!held;
  $('bbText').textContent = h
    ? 'Klik på gulvet for at placere · R roterer'
    : 'Byggetilstand: klik på et møbel for at flytte det';
  $('bbRot').classList.toggle('hidden', !h);
  $('bbCancel').classList.toggle('hidden', !h);
  $('bbSell').classList.toggle('hidden', !h || !!held?.isNew || !isOwner());
  if (held && !held.isNew) $('bbSell').textContent = `💰 Sælg (+${sellPrice(held.item.type)})`;
}
function heldOk() {
  if (!held) return false;
  const others = [...items.values()].filter((o) => o.id !== held!.item.id);
  const occupied = [...actors.values()]
    .filter((a) => a.seatId !== held!.item.id)
    .map((a) => a.tile());
  return canPlace(ROOM_SIZE, others, held.item, occupied);
}
function updHeld() {
  if (!held) {
    placeM.visible = false;
    return;
  }
  const g = placeObj(held.item, 0.12);
  const f = footprint(held.item);
  placeM.visible = true;
  placeM.scale.set(f.w, f.d, 1);
  placeM.position.set(g.position.x, 0.02, g.position.z);
  (placeM.material as T.MeshBasicMaterial).color.setHex(heldOk() ? 0x6fd36f : 0xe0564a);
}
function moveHeldTo(t: { x: number; z: number }) {
  if (!held) return;
  const f = footprint(held.item);
  held.item.x = Math.max(0, Math.min(ROOM_SIZE - f.w, t.x - Math.floor((f.w - 1) / 2)));
  held.item.z = Math.max(0, Math.min(ROOM_SIZE - f.d, t.z - Math.floor((f.d - 1) / 2)));
  updHeld();
}
function pickUp(it: PlacedItem) {
  held = { item: { ...it }, isNew: false, orig: it };
  removeObj(it.id);
  updHeld();
  updateBuildbar();
}
function startBuy(type: FurnitureType) {
  if (!me || !isOwner()) return toast('Du kan kun købe møbler til dit eget værelse', 'error');
  if (me.coins < furniture(type).price)
    return toast('Du har ikke mønter nok – klar en opgave 🙂', 'error');
  cancelHeld();
  closePanel();
  setBuild(true);
  held = { item: { id: -Date.now(), type, x: 3, z: 4, rot: 0 }, isNew: true };
  updHeld();
  updateBuildbar();
}
function tryPlace() {
  if (!held) return;
  if (!heldOk()) return toast('Det kan ikke stå der 🙃', 'error');
  const it = held.item;
  if (held.isNew) {
    net?.send({ t: 'buy', type: it.type, x: it.x, z: it.z, rot: it.rot });
    removeObj(it.id);
  } else {
    net?.send({ t: 'moveItem', id: it.id, x: it.x, z: it.z, rot: it.rot });
    placeObj(held.orig!);
  }
  held = null;
  placeM.visible = false;
  updateBuildbar();
}
function cancelHeld() {
  if (!held) return;
  if (held.isNew) removeObj(held.item.id);
  else placeObj(held.orig!);
  held = null;
  placeM.visible = false;
  updateBuildbar();
}
function rotateHeld() {
  if (!held) return;
  held.item.rot = (held.item.rot + 1) % 4;
  updHeld();
}
function sellHeld() {
  if (!held || held.isNew) return cancelHeld();
  net?.send({ t: 'sellItem', id: held.item.id });
  held = null;
  placeM.visible = false;
  updateBuildbar();
}

/* ---------------- input ---------------- */
const ray = new T.Raycaster();
const ptr = new T.Vector2();
function setPtr(e: { clientX: number; clientY: number }) {
  const r = cv.getBoundingClientRect();
  ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  ptr.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  ray.setFromCamera(ptr, stage.camera);
}
function hitTile(): { x: number; z: number } | null {
  const h = ray.intersectObjects(roomGfx.tiles, false)[0];
  return h ? (h.object.userData.tile as { x: number; z: number }) : null;
}
function hitItem(incWalk: boolean): PlacedItem | null {
  for (const h of ray.intersectObjects(furnRoot.children, true)) {
    const it = items.get(h.object.userData.itemId as number);
    if (it && (incWalk || !furniture(it.type).walk)) return it;
  }
  return null;
}
function hitActor(): Actor | null {
  const objsA = [...actors.values()].map((a) => a.obj);
  const h = ray.intersectObjects(objsA, true)[0];
  return h ? (actors.get(h.object.userData.playerId as string) ?? null) : null;
}
function onHover() {
  const t = hitTile();
  if (held) {
    if (t) moveHeldTo(t);
    return;
  }
  const it = hitItem(build);
  const onDoor = !build && ray.intersectObject(roomGfx.doorGroup, true).length > 0;
  const onActor = !build && !!hitActor();
  cv.style.cursor =
    onDoor || onActor || (it && (build || furniture(it.type).seat)) ? 'pointer' : 'default';
  if (t && !build && !it && !onActor) {
    hoverM.visible = true;
    hoverM.position.set(tw(t.x), 0.012, tw(t.z));
  } else hoverM.visible = false;
}
function onClick() {
  if (!net || !room) return;
  if (held) {
    const t = hitTile();
    if (t) moveHeldTo(t);
    return tryPlace();
  }
  if (build) {
    const it = hitItem(true);
    if (it) pickUp(it);
    return;
  }
  const a = hitActor();
  if (a) return net.send({ t: 'profile', userId: a.id });
  if (ray.intersectObject(roomGfx.doorGroup, true).length) {
    if (!onboarded()) return toast('Døren er låst 🔒 Klar startopgaverne først');
    return openNavigator();
  }
  const it = hitItem(false);
  if (it && furniture(it.type).seat) return net.send({ t: 'sit', itemId: it.id });
  const t = hitTile();
  if (t) {
    predictWalk([t.x, t.z], running);
    net.send({ t: 'move', x: t.x, z: t.z, run: running });
  }
  $('hint').style.opacity = '0';
}
let down: { x: number; y: number } | null = null;
let panning = false;
const pointers = new Map<number, { x: number; y: number }>();
let pinchDist = 0;
function pan(dx: number, dy: number) {
  const scale = (stage.camera.right - stage.camera.left) / (stage.camera.zoom * innerWidth);
  stage.camera.translateX(-dx * scale);
  stage.camera.translateY(dy * scale);
  // keep the room in view
  const p = stage.camera.position;
  const cx = p.x - 11;
  const cz = p.z - 11;
  if (Math.hypot(cx, cz) > 6) {
    const k = 6 / Math.hypot(cx, cz);
    p.x = 11 + cx * k;
    p.z = 11 + cz * k;
  }
}
cv.addEventListener('pointerdown', (e) => {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  down = { x: e.clientX, y: e.clientY };
  panning = false;
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchDist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
  }
});
cv.addEventListener('pointermove', (e) => {
  const prev = pointers.get(e.pointerId);
  if (prev) {
    if (pointers.size === 2) {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      if (pinchDist > 0) {
        stage.camera.zoom = Math.min(2.4, Math.max(0.7, stage.camera.zoom * (d / pinchDist)));
        stage.camera.updateProjectionMatrix();
      }
      pinchDist = d;
      panning = true;
      return;
    }
    if (down && !held && (panning || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10)) {
      panning = true;
      pan(e.clientX - prev.x, e.clientY - prev.y);
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }
  setPtr(e);
  onHover();
});
const endPointer = (e: PointerEvent) => {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinchDist = 0;
};
cv.addEventListener('pointercancel', endPointer);
cv.addEventListener('pointerup', (e) => {
  endPointer(e);
  if (!down) return;
  const wasPan = panning;
  down = null;
  panning = false;
  if (wasPan) return;
  setPtr(e);
  onClick();
});
if (innerWidth / innerHeight < 0.8) {
  stage.camera.zoom = 1.45;
  stage.camera.updateProjectionMatrix();
}

const KEYMAP: Record<string, string> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
  W: 'up',
  S: 'down',
  A: 'left',
  D: 'right',
};
addEventListener('keydown', (e) => {
  running = e.shiftKey;
  if (
    (e.target as HTMLElement).tagName === 'INPUT' ||
    (e.target as HTMLElement).tagName === 'TEXTAREA'
  )
    return;
  const k = KEYMAP[e.key];
  if (k && !held) {
    e.preventDefault();
    keys.add(k);
    $('hint').style.opacity = '0';
    return;
  }
  if ((e.key === 'r' || e.key === 'R') && held) rotateHeld();
  else if (e.key === 'Escape') {
    if (held) cancelHeld();
    else if (build) setBuild(false);
    else closePanel();
  } else if ((e.key === 'Delete' || e.key === 'Backspace') && held) sellHeld();
  else if (e.key === 'Enter') $('chatIn').focus();
});
addEventListener('keyup', (e) => {
  running = e.shiftKey;
  const k = KEYMAP[e.key];
  if (k) keys.delete(k);
});
addEventListener('blur', () => {
  keys.clear();
  running = false;
});

/**
 * Arrow keys walk freely in screen directions, like the prototype: the figure moves at once
 * and slides along furniture and walls. The position goes to the server ~10×/s ('glide').
 */
let lastGlideSent = 0;
let gliding = false;
function keyboardWalk(dt: number) {
  const a = myActor();
  if (!a || !net || held) return;
  let ix = 0;
  let iz = 0;
  if (keys.has('up')) {
    ix -= 1;
    iz -= 1;
  }
  if (keys.has('down')) {
    ix += 1;
    iz += 1;
  }
  if (keys.has('right')) {
    ix += 1;
    iz -= 1;
  }
  if (keys.has('left')) {
    ix -= 1;
    iz += 1;
  }
  const now = performance.now();
  if (!ix && !iz) {
    if (gliding) {
      gliding = false;
      net.send({ t: 'glide', x: a.x, z: a.z, run: running });
    }
    return;
  }
  const l = Math.hypot(ix, iz);
  ix /= l;
  iz /= l;
  const grid = buildGrid(ROOM_SIZE, [...items.values()]);
  const [cx, cz] = a.tile();
  const R = 0.28;
  const free = (x: number, z: number) => {
    const tx = Math.round(x);
    const tz = Math.round(z);
    if (tx < 0 || tz < 0 || tx >= ROOM_SIZE || tz >= ROOM_SIZE) return false;
    if (tx === cx && tz === cz) return true;
    return grid.cells[tx]![tz] === 0;
  };
  const st = WALK_SPEED * (running ? RUN_MULTIPLIER : 1) * dt;
  let x = a.x;
  let z = a.z;
  const nx = x + ix * st;
  if (free(nx + Math.sign(ix) * R, z)) x = nx;
  const nz = z + iz * st;
  if (free(x, nz + Math.sign(iz) * R)) z = nz;
  x = Math.min(ROOM_SIZE - 0.68, Math.max(-0.32, x));
  z = Math.min(ROOM_SIZE - 0.68, Math.max(-0.32, z));
  a.glide(x, z, running, Math.atan2(ix, iz));
  gliding = true;
  pending.length = 0;
  $('hint').style.opacity = '0';
  // Pushing into the door opens the hotel (same as clicking it).
  if (
    (keys.has('up') || keys.has('right')) &&
    z < -0.25 &&
    Math.round(x) === DOOR_TILE[0] &&
    Math.round(z) === DOOR_TILE[1] &&
    now > doorNagUntil
  ) {
    doorNagUntil = now + 2500;
    if (onboarded()) openNavigator();
    else toast('Døren er låst 🔒 Klar startopgaverne først');
  }
  if (now - lastGlideSent > 100) {
    lastGlideSent = now;
    net.send({ t: 'glide', x, z, run: running });
  }
}
let doorNagUntil = 0;

/* ---------------- buttons ---------------- */
$('bNav').addEventListener(
  'click',
  toggle('nav', () =>
    onboarded() ? openNavigator() : toast('Klar startopgaverne først – så åbner hotellet sig 🚪'),
  ),
);
$('bFriends').addEventListener('click', toggle('friends', renderFriends));
$('bFig').addEventListener('click', toggle('fig', renderFigure));
$('bShop').addEventListener('click', toggle('shop', renderShop));
$('bBuild').addEventListener('click', () => {
  closePanel();
  setBuild(!build);
});
$('bWave').addEventListener('click', () => net?.send({ t: 'action', kind: 'wave' }));
$('bDance').addEventListener('click', () => {
  const a = myActor();
  net?.send({ t: 'action', kind: a?.action === 'dance' ? 'stop' : 'dance' });
});
$('bbRot').addEventListener('click', rotateHeld);
$('bbSell').addEventListener('click', sellHeld);
$('bbCancel').addEventListener('click', cancelHeld);
$('qHead').addEventListener('click', () => $('quests').classList.toggle('min'));
$('chatForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const inp = $<HTMLInputElement>('chatIn');
  const text = inp.value.trim();
  if (!text || !net) return;
  inp.value = '';
  const w = /^\/w\s+(\S+)\s+(.+)$/i.exec(text);
  if (w) {
    const f = friends.find((x) => x.name.toLowerCase() === w[1]!.toLowerCase());
    if (!f) return toast('Du kan kun skrive privat til venner', 'error');
    return net.send({ t: 'whisper', to: f.id, text: w[2]! });
  }
  if (/^\/(dans|dance)$/i.test(text)) return net.send({ t: 'action', kind: 'dance' });
  if (/^\/(vink|wave)$/i.test(text)) return net.send({ t: 'action', kind: 'wave' });
  net.send({ t: 'chat', text });
});

/* ---------------- sign-up / login ---------------- */
type AuthMode = 'social' | 'signup' | 'login' | 'profile';
let authCfg: AuthConfig = {
  auth: 'password',
  supabaseUrl: null,
  supabaseAnonKey: null,
  inviteRequired: false,
  providers: [],
};
let authMode: AuthMode = 'signup';
let signupLook: Look = { ...DEFAULT_LOOK };
const social = () => authCfg.auth === 'supabase';
function showSignup(error = '', mode: AuthMode = social() ? 'social' : 'signup') {
  authMode = mode;
  $('signup').classList.remove('hidden');
  $('authCard').classList.toggle('hidden', mode !== 'social');
  $('authGoogle').classList.toggle('hidden', !authCfg.providers.includes('google'));
  $('authFacebook').classList.toggle('hidden', !authCfg.providers.includes('facebook'));
  $('signupForm').classList.toggle('hidden', mode !== 'signup' && mode !== 'profile');
  $('loginForm').classList.toggle('hidden', mode !== 'login');
  // A social account has no Hutel password – the profile step only asks for name and figure.
  const profile = mode === 'profile';
  // In the profile step the password is optional: it links an old name+password account.
  $('suPwLabel').textContent = profile
    ? 'Gammel adgangskode (kun hvis du har en konto)'
    : 'Adgangskode';
  $<HTMLInputElement>('suPw').required = !profile;
  $<HTMLInputElement>('suPw').placeholder = profile
    ? 'Behold din gamle figur og dine mønter'
    : 'Mindst 8 tegn';
  $<HTMLInputElement>('suPw').minLength = profile ? 0 : 8;
  $('toLoginRow').classList.toggle('hidden', profile || social());
  $('toSocialRow').classList.toggle('hidden', !social());
  $('signupForm').querySelector('h1')!.textContent = profile
    ? 'Lav din figur'
    : 'Velkommen til Hutel';
  $('authError').textContent = mode === 'social' ? error : '';
  $('suError').textContent = mode === 'signup' || profile ? error : '';
  $('liError').textContent = mode === 'login' ? error : '';
  lookEditor($('suLook'), signupLook, (l) => (signupLook = l));
}
/** Trade a Supabase login for a Hutel game token (and create the figure the first time). */
async function exchange(profile?: object): Promise<boolean> {
  const at = await accessToken(authCfg).catch(() => null);
  if (!at) return false;
  const res = await fetch(`${SERVER}/api/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ accessToken: at, profile }),
  });
  const data = (await res.json()) as {
    ok: boolean;
    token?: string;
    needsProfile?: boolean;
    error?: string;
  };
  if (data.ok && data.needsProfile) {
    showSignup('', 'profile');
    return true;
  }
  if (!data.ok || !data.token) {
    showSignup(data.error ?? 'Noget gik galt.', profile ? 'profile' : 'social');
    return true;
  }
  store.set(TOKEN_KEY, data.token);
  $('signup').classList.add('hidden');
  start(data.token);
  return true;
}
$('termsLink').addEventListener('click', (e) => {
  e.preventDefault();
  $('terms').classList.remove('hidden');
});
$('toLogin').addEventListener('click', (e) => {
  e.preventDefault();
  showSignup('', 'login');
});
$('toSignup').addEventListener('click', (e) => {
  e.preventDefault();
  showSignup('', social() ? 'social' : 'signup');
});
$('toPwLogin').addEventListener('click', (e) => {
  e.preventDefault();
  showSignup('', 'login');
});
$('toSocial').addEventListener('click', (e) => {
  e.preventDefault();
  showSignup('', 'social');
});
for (const [id, provider] of [
  ['authGoogle', 'google'],
  ['authFacebook', 'facebook'],
] as const)
  $(id).addEventListener('click', () => {
    $('authError').textContent = '';
    signInWithProvider(authCfg, provider).catch(
      () => ($('authError').textContent = 'Det login virker ikke lige nu. Prøv e-mail i stedet.'),
    );
  });
$('emailForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $<HTMLInputElement>('authEmail').value.trim();
  $('authError').textContent = '';
  try {
    await signInWithEmail(authCfg, email);
    $('authMsg').textContent = `Tjek din mail (${email}) – klik på linket for at komme ind. ✉️`;
  } catch {
    $('authError').textContent = 'Kunne ikke sende mailen. Tjek adressen og prøv igen om lidt.';
  }
});
$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const res = await fetch(`${SERVER}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: $<HTMLInputElement>('liName').value.trim(),
        password: $<HTMLInputElement>('liPw').value,
      }),
    });
    const data = (await res.json()) as { ok: boolean; token?: string; error?: string };
    if (!data.ok || !data.token)
      return ($('liError').textContent = data.error ?? 'Noget gik galt.');
    store.set(TOKEN_KEY, data.token);
    start(data.token);
  } catch {
    $('liError').textContent = 'Kan ikke nå hotellet lige nu. Prøv igen om lidt.';
  }
});
$('termsClose').addEventListener('click', () => $('terms').classList.add('hidden'));
$('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $<HTMLInputElement>('suName').value.trim();
  const adult = $<HTMLInputElement>('suAdult').checked;
  const terms = $<HTMLInputElement>('suTerms').checked;
  if (!adult || !terms)
    return ($('suError').textContent = 'Du skal være fyldt 18 og acceptere vilkårene.');
  const invite = $<HTMLInputElement>('suInvite').value.trim() || undefined;
  if (authMode === 'profile') {
    try {
      const password = $<HTMLInputElement>('suPw').value || undefined;
      await exchange({ name, look: signupLook, invite, adult, terms, password });
    } catch {
      $('suError').textContent = 'Kan ikke nå hotellet lige nu. Prøv igen om lidt.';
    }
    return;
  }
  try {
    const res = await fetch(`${SERVER}/api/guest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name,
        look: signupLook,
        password: $<HTMLInputElement>('suPw').value,
        invite,
        adult,
        terms,
      }),
    });
    const data = (await res.json()) as { ok: boolean; token?: string; error?: string };
    if (!data.ok || !data.token)
      return ($('suError').textContent = data.error ?? 'Noget gik galt.');
    store.set(TOKEN_KEY, data.token);
    start(data.token);
  } catch {
    $('suError').textContent = 'Kan ikke nå hotellet lige nu. Prøv igen om lidt.';
  }
});

function start(token: string) {
  net?.close();
  net = new Net(WS_URL, token);
  net.onMessage = handle;
  net.onStatus = (s) => $('conn').classList.toggle('hidden', s !== 'offline');
  net.onFatal = (code) => {
    if (code === 4001) {
      store.set(TOKEN_KEY, null);
      showSignup('Du er blevet logget ud – log ind igen.', social() ? 'social' : 'login');
    } else if (code === 4003) toast('Din konto er midlertidigt udelukket.', 'error');
    else if (code === 4000) toast('Du er logget ind et andet sted.', 'error');
  };
  net.connect();
}

/* ---------------- loop ---------------- */
const v3 = new T.Vector3();
function screen(a: Actor, yOff: number): [number, number] {
  v3.set(a.obj.position.x, a.obj.position.y + yOff, a.obj.position.z).project(stage.camera);
  return [((v3.x + 1) / 2) * innerWidth, ((1 - v3.y) / 2) * innerHeight];
}
const clock = new T.Clock();
let time = 0;
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);
  time += dt;
  const now = net ? net.now() : Date.now();
  keyboardWalk(dt);
  for (const a of actors.values()) a.update(dt, now, items);
  roomGfx.update(dt, time);
  for (const g of objs.values())
    if (g.userData.type === 'aquarium')
      g.traverse((m) => {
        if (m instanceof T.Mesh && m.scale.x > 1.5)
          m.position.x = Math.sin(time * 0.8 + m.position.y * 10) * 0.25;
      });
  for (const a of actors.values()) {
    const [x, y] = screen(a, 1.5);
    a.tag.style.transform = `translate(${x}px,${y}px) translate(-50%,-100%)`;
  }
  const t = performance.now();
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i]!;
    const age = (t - b.born) / 1000;
    const a = actors.get(b.who);
    if (age > 7 || !a) {
      b.el.remove();
      bubbles.splice(i, 1);
      continue;
    }
    const [x, y] = screen(a, 1.5);
    b.el.style.transform = `translate(${x}px,${y - 26 - b.off - age * 5}px) translate(-50%,-100%)`;
    b.el.style.opacity = String(age > 5.5 ? Math.max(0, (7 - age) / 1.5) : 1);
  }
  stage.render();
  requestAnimationFrame(loop);
}

roomGfx.setTheme('home');
async function boot() {
  authCfg = await loadConfig(SERVER);
  const saved = store.get(TOKEN_KEY);
  if (social() && (isAuthRedirect() || !saved)) {
    try {
      if (await exchange()) return;
    } catch {
      /* fall through to the login screen */
    }
  }
  if (saved) start(saved);
  else showSignup();
}
void boot();
loop();
