// จัดทำโดย tawan_x2noban | TAWAN SHOP
if (!window.FIREBASE_CONFIG) {
    alert('ERROR: Missing Firebase config. Please check deployment.');
}
firebase.initializeApp(window.FIREBASE_CONFIG);
const database = firebase.database();

// DOM elements
const lobbyScreen = document.getElementById('lobbyScreen');
const gameScreen = document.getElementById('gameScreen');
const roomIdInput = document.getElementById('roomIdInput');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const createRoomBtn = document.getElementById('createRoomBtn');
const lobbyError = document.getElementById('lobbyError');
const roomIdDisplay = document.getElementById('roomIdDisplay');
const playerSymbolDisplay = document.getElementById('playerSymbolDisplay');
const copyRoomBtn = document.getElementById('copyRoomBtn');
const leaveGameBtn = document.getElementById('leaveGameBtn');
const gameStatus = document.getElementById('gameStatus');
const boardDiv = document.getElementById('board');
const resetGameBtn = document.getElementById('resetGameBtn');
const gameError = document.getElementById('gameError');

let currentRoomId = null;
let mySymbol = null;
let gameRef = null;
let turn = null;
let boardState = ['','','','','','','','',''];
let gameActive = true;
let winner = null;
let isMyTurn = false;

function createBoardUI() {
    boardDiv.innerHTML = '';
    for (let i = 0; i < 9; i++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.dataset.index = i;
        cell.addEventListener('click', () => onCellClick(i));
        boardDiv.appendChild(cell);
    }
}

function updateBoardUI() {
    const cells = document.querySelectorAll('.cell');
    for (let i = 0; i < cells.length; i++) {
        const val = boardState[i];
        cells[i].innerText = val;
        cells[i].classList.remove('X', 'O');
        if (val === 'X') cells[i].classList.add('X');
        if (val === 'O') cells[i].classList.add('O');
        if (!gameActive || winner !== null || !isMyTurn || boardState[i] !== '') {
            cells[i].classList.add('disabled');
        } else {
            cells[i].classList.remove('disabled');
        }
    }
}

function checkWinner(board) {
    const patterns = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (let p of patterns) {
        if (board[p[0]] && board[p[0]] === board[p[1]] && board[p[0]] === board[p[2]])
            return board[p[0]];
    }
    if (board.every(c => c !== '')) return 'tie';
    return null;
}

function updateGameStatusMessage() {
    if (winner === 'X') gameStatus.innerText = '❌ X ชนะ!';
    else if (winner === 'O') gameStatus.innerText = '⭕ O ชนะ!';
    else if (winner === 'tie') gameStatus.innerText = '🤝 เสมอ!';
    else {
        if (!gameActive) gameStatus.innerText = '⚠️ เกมไม่พร้อม';
        else if (turn === mySymbol) gameStatus.innerText = `🎯 เทิร์นของคุณ (${mySymbol})`;
        else gameStatus.innerText = `⏳ รอผู้เล่น ${turn}...`;
    }
}

function resetGameLocally() {
    if (!gameRef) return;
    gameRef.update({
        board: ['','','','','','','','',''],
        winner: null,
        turn: 'X',
        gameActive: true
    }).catch(e => gameError.innerText = e.message);
}

async function leaveGame() {
    if (!currentRoomId) return;
    const roomRef = database.ref('games/' + currentRoomId);
    const path = mySymbol === 'X' ? 'playerX' : 'playerO';
    await roomRef.child(path).remove();
    const snap = await roomRef.once('value');
    if (snap.exists() && !snap.val().playerX && !snap.val().playerO) {
        await roomRef.remove();
    }
    if (gameRef) gameRef.off();
    currentRoomId = null;
    lobbyScreen.classList.add('active');
    gameScreen.classList.remove('active');
}

function copyRoomCode() {
    if (currentRoomId) {
        navigator.clipboard.writeText(currentRoomId);
        gameError.innerText = '✅ คัดลอกแล้ว';
        setTimeout(() => gameError.innerText = '', 2000);
    }
}

function setupGameListener(roomId, symbol) {
    if (gameRef) gameRef.off();
    gameRef = database.ref('games/' + roomId);
    gameRef.on('value', (snap) => {
        const data = snap.val();
        if (!data) { leaveGame(); return; }
        boardState = data.board ? [...data.board] : ['','','','','','','','',''];
        turn = data.turn || 'X';
        winner = data.winner || null;
        gameActive = data.gameActive !== false;
        const hasBoth = data.playerX && data.playerO;
        if (!hasBoth) {
            gameStatus.innerText = '⏳ รอผู้เล่นอีกฝ่าย...';
            isMyTurn = false;
            updateBoardUI();
            return;
        }
        isMyTurn = gameActive && !winner && turn === symbol;
        updateBoardUI();
        updateGameStatusMessage();
    });
}

async function onCellClick(idx) {
    if (!gameActive || winner || !isMyTurn || boardState[idx] !== '') return;
    const newBoard = [...boardState];
    newBoard[idx] = mySymbol;
    const win = checkWinner(newBoard);
    const newTurn = (!win && !newBoard.every(c=>c!=='')) ? (mySymbol === 'X' ? 'O' : 'X') : turn;
    const newWinner = win === 'tie' ? 'tie' : win;
    await gameRef.update({
        [`board/${idx}`]: mySymbol,
        turn: newTurn,
        winner: newWinner,
        gameActive: newWinner === null
    });
}

async function joinRoom(roomId) {
    roomId = roomId.trim().toUpperCase();
    if (roomId.length !== 4) {
        lobbyError.innerText = 'รหัสต้อง 4 ตัว';
        return;
    }
    lobbyError.innerText = 'กำลังเชื่อมต่อ...';
    const roomRef = database.ref('games/' + roomId);
    const snap = await roomRef.once('value');
    const room = snap.val();
    if (!room) { lobbyError.innerText = 'ไม่พบห้อง'; return; }
    if (room.playerX && room.playerO) { lobbyError.innerText = 'ห้องเต็ม'; return; }
    const assigned = room.playerX ? 'O' : 'X';
    await roomRef.child(assigned === 'X' ? 'playerX' : 'playerO').set({ id: Date.now().toString(), joinedAt: Date.now() });
    if (!room.board) {
        await roomRef.update({ board: ['','','','','','','','',''], turn: 'X', winner: null, gameActive: true });
    }
    currentRoomId = roomId;
    mySymbol = assigned;
    roomIdDisplay.innerText = roomId;
    playerSymbolDisplay.innerText = mySymbol;
    setupGameListener(roomId, assigned);
    lobbyScreen.classList.remove('active');
    gameScreen.classList.add('active');
}

async function createRoom() {
    let newId = '';
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
    for (let i=0;i<4;i++) newId += chars[Math.floor(Math.random()*chars.length)];
    const roomRef = database.ref('games/' + newId);
    if ((await roomRef.once('value')).exists()) return createRoom();
    await roomRef.set({
        playerX: { id: Date.now().toString(), joinedAt: Date.now() },
        board: ['','','','','','','','',''],
        turn: 'X',
        winner: null,
        gameActive: true,
        createdAt: Date.now()
    });
    currentRoomId = newId;
    mySymbol = 'X';
    roomIdDisplay.innerText = newId;
    playerSymbolDisplay.innerText = 'X';
    setupGameListener(newId, 'X');
    lobbyScreen.classList.remove('active');
    gameScreen.classList.add('active');
}

function init() {
    createBoardUI();
    createRoomBtn.onclick = createRoom;
    joinRoomBtn.onclick = () => joinRoom(roomIdInput.value);
    leaveGameBtn.onclick = leaveGame;
    copyRoomBtn.onclick = copyRoomCode;
    resetGameBtn.onclick = resetGameLocally;
    roomIdInput.onkeypress = (e) => { if (e.key === 'Enter') joinRoom(roomIdInput.value); };
    console.log('🔥 XO Real-time by tawan_x2noban | TAWAN SHOP');
}
init();