// script.js - VERSI SEMUA BISA DRAG + FIX ANDROID
import { database } from './firebase-config.js';
import { ref, push, onChildAdded, onChildChanged, onChildRemoved, set, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// ========== KONFIGURASI WARNA ==========
const COLOR_PALETTE = [
    '#E76F51', '#F4A261', '#E9C46A', '#6A994E', '#A7C957',
    '#BC4C5C', '#5E548E', '#3D5A80', '#98C1D9', '#EE6C4D'
];

// ========== KONFIGURASI UKURAN ==========
function getBallRadius() {
    if (!canvas) return 30;
    const width = canvas.width;
    if (width < 400) return 25;
    if (width < 700) return 30;
    if (width < 1000) return 32;
    return 35;
}

// ========== STATE ==========
let balls = new Map();
let canvas, ctx;
let animationFrame;
let selectedColor = COLOR_PALETTE[0];
let draggedBall = null;
let dragOffsetX, dragOffsetY;
let isDragging = false;
let popupTimeout = null;
let myBallId = null;
let myUsername = '';

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.hostname !== 'localhost') {
        console.log = function() {};
        console.warn = function() {};
    }
    initApp();
});

async function initApp() {
    loadUserData();
    initColorOptions();
    initCanvas();
    await initFirebaseListeners();
    initEventListeners();
    startAnimation();
    
    setTimeout(() => {
        document.getElementById('loadingScreen').classList.add('fade-out');
        document.getElementById('mainApp').style.display = 'flex';
        setTimeout(() => {
            document.getElementById('loadingScreen').style.display = 'none';
        }, 500);
    }, 1500);
}

// ========== LOCALSTORAGE ==========
function loadUserData() {
    const saved = localStorage.getItem('lemperBola_user');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            myUsername = data.username;
            myBallId = data.ballId;
            document.getElementById('username').value = myUsername;
        } catch (e) {}
    } else {
        myUsername = `User${Math.floor(Math.random() * 1000)}`;
        document.getElementById('username').value = myUsername;
    }
}

function saveUserData() {
    localStorage.setItem('lemperBola_user', JSON.stringify({
        username: myUsername,
        ballId: myBallId
    }));
}

// ========== COLOR OPTIONS ==========
function initColorOptions() {
    const container = document.getElementById('colorOptions');
    if (!container) return;
    
    container.innerHTML = '';
    
    COLOR_PALETTE.forEach((color, index) => {
        const dot = document.createElement('div');
        dot.className = `color-dot ${index === 0 ? 'selected' : ''}`;
        dot.style.backgroundColor = color;
        dot.style.width = '35px';
        dot.style.height = '35px';
        dot.style.borderRadius = '50%';
        dot.style.cursor = 'pointer';
        dot.style.display = 'inline-block';
        dot.style.margin = '5px';
        dot.style.border = index === 0 ? '3px solid white' : '2px solid transparent';
        
        dot.addEventListener('click', () => {
            document.querySelectorAll('.color-dot').forEach(d => {
                d.style.border = '2px solid transparent';
                d.classList.remove('selected');
            });
            dot.style.border = '3px solid white';
            dot.classList.add('selected');
            selectedColor = color;
        });
        
        container.appendChild(dot);
    });
}

// ========== CANVAS ==========
function initCanvas() {
    canvas = document.getElementById('bolaCanvas');
    if (!canvas) return;
    
    ctx = canvas.getContext('2d');
    resizeCanvas();
    
    window.addEventListener('resize', () => {
        resizeCanvas();
        repositionBalls();
    });
}

function resizeCanvas() {
    if (!canvas || !canvas.parentElement) return;
    const container = canvas.parentElement;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function repositionBalls() {
    if (!canvas) return;
    const radius = getBallRadius();
    balls.forEach((ball) => {
        if (ball.x > canvas.width - radius) ball.x = canvas.width - radius;
        if (ball.x < radius) ball.x = radius;
        if (ball.y > canvas.height - radius) ball.y = canvas.height - radius;
        if (ball.y < radius) ball.y = radius;
    });
}

// ========== FIREBASE ==========
async function initFirebaseListeners() {
    return new Promise((resolve) => {
        if (!database) {
            resolve();
            return;
        }
        
        const ballsRef = ref(database, 'balls');
        
        if (myBallId) {
            get(ref(database, `balls/${myBallId}`)).then((snapshot) => {
                if (!snapshot.exists()) {
                    myBallId = null;
                    saveUserData();
                }
            });
        }
        
        onChildAdded(ballsRef, (snapshot) => {
            const ball = snapshot.val();
            const ballId = snapshot.key;
            
            if (!ball || balls.has(ballId)) return;
            
            if (ball.userName === myUsername && !myBallId) {
                myBallId = ballId;
                saveUserData();
            }
            
            const radius = getBallRadius();
            const newBall = {
                id: ballId,
                userName: ball.userName || 'Anonim',
                message: ball.message || '...',
                color: ball.color || COLOR_PALETTE[0],
                timestamp: ball.timestamp || Date.now(),
                x: ball.x && !isNaN(ball.x) && ball.x > 0 ? ball.x : Math.random() * (canvas.width - 2*radius) + radius,
                y: ball.y && !isNaN(ball.y) && ball.y > 0 ? ball.y : Math.random() * (canvas.height - 2*radius) + radius,
                vx: ball.vx || (Math.random() - 0.5) * 0.2,
                vy: ball.vy || (Math.random() - 0.5) * 0.2,
                isMine: ball.userName === myUsername
            };
            
            balls.set(ballId, newBall);
            
            if (newBall.isMine) {
                updateButtonState(true);
            }
        });
        
        onChildChanged(ballsRef, (snapshot) => {
            const updatedBall = snapshot.val();
            const ballId = snapshot.key;
            
            if (balls.has(ballId)) {
                const ball = balls.get(ballId);
                balls.set(ballId, {
                    ...ball,
                    ...updatedBall,
                    x: updatedBall.x !== undefined ? updatedBall.x : ball.x,
                    y: updatedBall.y !== undefined ? updatedBall.y : ball.y
                });
            }
        });
        
        onChildRemoved(ballsRef, (snapshot) => {
            const ballId = snapshot.key;
            if (ballId === myBallId) {
                myBallId = null;
                updateButtonState(false);
                saveUserData();
            }
            balls.delete(ballId);
        });
        
        setTimeout(resolve, 2000);
    });
}

function updateButtonState(hasBall) {
    const btn = document.getElementById('lemperBtn');
    if (!btn) return;
    
    if (hasBall) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-check"></i> KAMU UDAH PUNYA BOLA';
        btn.style.backgroundColor = '#6A994E';
    } else {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-rocket"></i> LEMPER BOLAKU!';
        btn.style.backgroundColor = '#e76f51';
    }
}

// ========== LEMPER BOLA ==========
function lemperBola() {
    if (myBallId) {
        showNotification('⚠️ Kamu cuma bisa punya 1 bola!', 2000);
        return;
    }
    
    const username = document.getElementById('username').value.trim();
    const message = document.getElementById('message').value.trim();
    
    if (!username || !message) {
        showNotification('⚠️ Isi semua!', 2000);
        return;
    }
    
    myUsername = username;
    
    if (!canvas) resizeCanvas();
    
    const radius = getBallRadius();
    const randomX = Math.floor(Math.random() * (canvas.width - 2*radius)) + radius;
    const randomY = Math.floor(Math.random() * (canvas.height - 2*radius)) + radius;
    
    const newBall = {
        userName: username,
        message: message,
        color: selectedColor,
        timestamp: Date.now(),
        x: randomX,
        y: randomY,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2
    };
    
    const ballsRef = ref(database, 'balls');
    push(ballsRef, newBall)
        .then((result) => {
            myBallId = result.key;
            saveUserData();
            document.getElementById('message').value = '';
            showNotification('🚀 Bola udah dilemper!', 1500);
        })
        .catch(() => {
            showNotification('❌ Gagal, coba lagi', 2000);
        });
}

// ========== NOTIF ==========
function showNotification(text, duration) {
    const oldNotif = document.querySelector('.notification');
    if (oldNotif) oldNotif.remove();
    
    const notif = document.createElement('div');
    notif.style.position = 'fixed';
    notif.style.top = '20px';
    notif.style.left = '50%';
    notif.style.transform = 'translateX(-50%)';
    notif.style.backgroundColor = '#2b313f';
    notif.style.color = 'white';
    notif.style.padding = '12px 24px';
    notif.style.borderRadius = '40px';
    notif.style.border = '2px solid #e76f51';
    notif.style.zIndex = '9999';
    notif.style.fontWeight = 'bold';
    notif.innerText = text;
    
    document.body.appendChild(notif);
    
    setTimeout(() => {
        notif.style.opacity = '0';
        setTimeout(() => notif.remove(), 300);
    }, duration);
}

// ========== ANIMASI ==========
function startAnimation() {
    function animate() {
        if (ctx && canvas) {
            updateBalls();
            drawBalls();
        }
        animationFrame = requestAnimationFrame(animate);
    }
    animate();
}

function updateBalls() {
    if (!canvas) return;
    
    const radius = getBallRadius();
    
    balls.forEach((ball) => {
        if (!draggedBall || draggedBall.id !== ball.id) {
            ball.x += ball.vx;
            ball.y += ball.vy;
        }
        
        if (ball.x < radius) {
            ball.x = radius;
            ball.vx = Math.abs(ball.vx);
        }
        if (ball.x > canvas.width - radius) {
            ball.x = canvas.width - radius;
            ball.vx = -Math.abs(ball.vx);
        }
        if (ball.y < radius) {
            ball.y = radius;
            ball.vy = Math.abs(ball.vy);
        }
        if (ball.y > canvas.height - radius) {
            ball.y = canvas.height - radius;
            ball.vy = -Math.abs(ball.vy);
        }
    });
}

function drawBalls() {
    if (!ctx || !canvas) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const radius = getBallRadius();
    const fontSize = Math.max(14, Math.floor(radius * 0.7));
    
    balls.forEach((ball) => {
        // Shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = radius / 3;
        ctx.shadowOffsetY = 3;
        
        // Lingkaran
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = ball.color;
        ctx.fill();
        
        // Border putih
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = Math.max(2, Math.floor(radius / 10));
        ctx.stroke();
        
        // Inisial
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${fontSize}px "Inter", "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = radius / 5;
        
        const initial = ball.userName ? ball.userName.charAt(0).toUpperCase() : '?';
        ctx.fillText(initial, ball.x, ball.y - radius/5);
        
        // Username
        ctx.font = `${Math.max(10, Math.floor(radius/3))}px "Inter", "Segoe UI", sans-serif`;
        let displayName = ball.userName || 'anon';
        if (displayName.length > 8) {
            displayName = displayName.substring(0, 6) + '..';
        }
        
        ctx.fillText(displayName, ball.x, ball.y + radius/1.8);
    });
    
    document.getElementById('onlineCount').textContent = balls.size;
}

// ========== DRAG - SEMUA BISA DRAG ==========
function initEventListeners() {
    const lemperBtn = document.getElementById('lemperBtn');
    const messageInput = document.getElementById('message');
    
    if (lemperBtn) {
        lemperBtn.addEventListener('click', (e) => {
            e.preventDefault();
            lemperBola();
        });
    }
    
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                lemperBola();
            }
        });
    }
    
    if (canvas) {
        // Mouse events
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('mouseleave', handleMouseUp);
        
        // Touch events - FIX ANDROID
        canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
        canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
        canvas.addEventListener('touchend', handleTouchEnd);
        canvas.addEventListener('touchcancel', handleTouchEnd);
        
        // Click untuk popup - pake touchend juga
        canvas.addEventListener('click', handleCanvasClick);
        canvas.addEventListener('touchend', handleCanvasTouch);
    }
}

function handleMouseDown(e) {
    e.preventDefault();
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;
    
    const radius = getBallRadius();
    
    // SEMUA BOLA BISA DRAG (GA ADA FILTER isMine)
    const ballsArray = Array.from(balls.entries()).reverse();
    
    for (const [id, ball] of ballsArray) {
        const dx = mouseX - ball.x;
        const dy = mouseY - ball.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < radius) {
            draggedBall = { id };
            dragOffsetX = ball.x - mouseX;
            dragOffsetY = ball.y - mouseY;
            ball.vx = 0;
            ball.vy = 0;
            isDragging = true;
            break;
        }
    }
}

function handleMouseMove(e) {
    if (!draggedBall || !isDragging || !canvas) return;
    e.preventDefault();
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;
    
    const ball = balls.get(draggedBall.id);
    if (ball) {
        ball.x = mouseX + dragOffsetX;
        ball.y = mouseY + dragOffsetY;
        
        const radius = getBallRadius();
        ball.x = Math.max(radius, Math.min(canvas.width - radius, ball.x));
        ball.y = Math.max(radius, Math.min(canvas.height - radius, ball.y));
    }
}

function handleMouseUp() {
    if (draggedBall && isDragging) {
        const ball = balls.get(draggedBall.id);
        if (ball) {
            ball.vx = (Math.random() - 0.5) * 0.5;
            ball.vy = (Math.random() - 0.5) * 0.5;
            
            const ballRef = ref(database, `balls/${draggedBall.id}`);
            set(ballRef, {
                ...ball,
                x: Math.round(ball.x),
                y: Math.round(ball.y),
                timestamp: Date.now()
            });
        }
        draggedBall = null;
        isDragging = false;
    }
}

// ========== TOUCH HANDLERS - FIX ANDROID ==========
function handleTouchStart(e) {
    e.preventDefault();
    if (!canvas || e.touches.length === 0) return;
    
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const touchX = (touch.clientX - rect.left) * scaleX;
    const touchY = (touch.clientY - rect.top) * scaleY;
    
    const radius = getBallRadius();
    
    // SEMUA BOLA BISA DRAG
    const ballsArray = Array.from(balls.entries()).reverse();
    
    for (const [id, ball] of ballsArray) {
        const dx = touchX - ball.x;
        const dy = touchY - ball.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < radius + 5) { // +5 biar gampang di touch
            draggedBall = { id };
            dragOffsetX = ball.x - touchX;
            dragOffsetY = ball.y - touchY;
            ball.vx = 0;
            ball.vy = 0;
            isDragging = true;
            break;
        }
    }
}

function handleTouchMove(e) {
    if (!draggedBall || !isDragging || !canvas) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const touchX = (touch.clientX - rect.left) * scaleX;
    const touchY = (touch.clientY - rect.top) * scaleY;
    
    const ball = balls.get(draggedBall.id);
    if (ball) {
        ball.x = touchX + dragOffsetX;
        ball.y = touchY + dragOffsetY;
        
        const radius = getBallRadius();
        ball.x = Math.max(radius, Math.min(canvas.width - radius, ball.x));
        ball.y = Math.max(radius, Math.min(canvas.height - radius, ball.y));
    }
}

function handleTouchEnd(e) {
    e.preventDefault();
    
    if (draggedBall && isDragging) {
        const ball = balls.get(draggedBall.id);
        if (ball) {
            ball.vx = (Math.random() - 0.5) * 0.5;
            ball.vy = (Math.random() - 0.5) * 0.5;
            
            const ballRef = ref(database, `balls/${draggedBall.id}`);
            set(ballRef, {
                ...ball,
                x: Math.round(ball.x),
                y: Math.round(ball.y),
                timestamp: Date.now()
            });
        }
        draggedBall = null;
        isDragging = false;
    }
}

// ========== POPUP - FIX ANDROID ==========
function handleCanvasClick(e) {
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;
    
    showPopupAtPosition(mouseX, mouseY);
}

function handleCanvasTouch(e) {
    e.preventDefault();
    if (!canvas || e.touches.length > 0) return; // Skip kalo masih touch
    
    const touch = e.changedTouches[0];
    if (!touch) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const touchX = (touch.clientX - rect.left) * scaleX;
    const touchY = (touch.clientY - rect.top) * scaleY;
    
    showPopupAtPosition(touchX, touchY);
}

function showPopupAtPosition(x, y) {
    let clickedBall = null;
    let minDistance = getBallRadius() + 10;
    
    // Cari dari bola paling atas
    const ballsArray = Array.from(balls.entries()).reverse();
    
    for (const [id, ball] of ballsArray) {
        const dx = x - ball.x;
        const dy = y - ball.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < minDistance) {
            clickedBall = ball;
            break;
        }
    }
    
    if (clickedBall) {
        showPopup(clickedBall, x, y);
    }
}

function showPopup(ball, x, y) {
    const oldPopup = document.querySelector('.bola-popup');
    if (oldPopup) oldPopup.remove();
    
    const popup = document.createElement('div');
    popup.style.position = 'absolute';
    popup.style.backgroundColor = '#2b313f';
    popup.style.border = '2px solid #e76f51';
    popup.style.borderRadius = '12px';
    popup.style.padding = '12px';
    popup.style.minWidth = '180px';
    popup.style.zIndex = '1000';
    popup.style.boxShadow = '4px 4px 0 rgba(0,0,0,0.3)';
    popup.style.pointerEvents = 'none';
    popup.style.color = 'white';
    
    let popupX = x + 15;
    let popupY = y - 70;
    const containerRect = canvas.parentElement.getBoundingClientRect();
    
    if (popupX + 180 > containerRect.width) {
        popupX = x - 195;
    }
    if (popupY < 10) {
        popupY = y + 35;
    }
    
    popup.style.left = popupX + 'px';
    popup.style.top = popupY + 'px';
    
    const time = ball.timestamp ? new Date(ball.timestamp).toLocaleTimeString() : 'baru saja';
    
    popup.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; border-bottom: 1px solid #3f4658; padding-bottom: 4px;">
            <i class="fas fa-user" style="color: #ffd966;"></i>
            <span style="font-weight: 700; color: #ffd966;">${ball.userName || 'Anonim'}</span>
        </div>
        <div style="font-size: 14px; margin-bottom: 6px;">
            ${ball.message || '...'}
        </div>
        <div style="color: #9ca3af; font-size: 10px;">
            <i class="far fa-clock"></i> ${time}
        </div>
    `;
    
    canvas.parentElement.appendChild(popup);
    
    if (popupTimeout) clearTimeout(popupTimeout);
    popupTimeout = setTimeout(() => {
        if (popup.parentNode) popup.remove();
    }, 2500);
}
