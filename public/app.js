import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAuqo9MoZ9lr4STXztO36n0ASqHOytdAeI",
    authDomain: "rehli-digital-asset.firebaseapp.com",
    projectId: "rehli-digital-asset",
    storageBucket: "rehli-digital-asset.firebasestorage.app",
    messagingSenderId: "779415089179",
    appId: "1:779415089179:web:4f6654088af999ed7ac8be"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const mobile = localStorage.getItem('userMobile');
let globalActiveMerchant = null;

// [1. STARTUP]
window.addEventListener('DOMContentLoaded', async () => {
    if (mobile) {
        document.getElementById('dashboardContainer').classList.remove('hidden-screen');
        await loadCachedDashboard();
    } else {
        document.getElementById('authContainer').classList.remove('hidden-screen');
        detectReferral();
    }
});

// [2. SESSION CACHING] - रीड्स बचाने के लिए
async function loadCachedDashboard(force = false) {
    const cache = sessionStorage.getItem('user_data');
    if (cache && !force) {
        renderUI(JSON.parse(cache));
    } else {
        const snap = await getDoc(doc(db, "users", mobile));
        if (snap.exists()) {
            const data = snap.data();
            sessionStorage.setItem('user_data', JSON.stringify(data));
            renderUI(data);
        }
    }
    fetchUnusedVideos();
}

function renderUI(data) {
    document.getElementById('dashBalance').innerText = data.balance || 0;
    document.getElementById('sideMenuUser').innerText = data.userName || "User";
    document.getElementById('sideMenuPhone').innerText = "+91 " + mobile;
    
    // Wallet Calculations
    document.getElementById('statEarned').innerText = data.totalEarned || data.balance;
    document.getElementById('statSpent').innerText = data.totalSpent || 0;
    document.getElementById('statValue').innerText = "₹" + ((data.balance || 0) / 100).toFixed(2);
    
    // Profile Logic
    if (data.profileComplete) {
        document.getElementById('profileFormArea').classList.add('hidden-screen');
        document.getElementById('profileViewArea').classList.remove('hidden-screen');
        document.getElementById('vName').innerText = data.userName;
        document.getElementById('vDob').innerText = data.dob;
        document.getElementById('vPhone').innerText = data.mobile;
    }
}

// [3. NAVIGATION]
window.switchAppTab = (tab) => {
    toggleSidebar(false);
    document.querySelectorAll('.tab-pane').forEach(el => el.classList.add('hidden-screen'));
    document.getElementById('tab-' + tab).classList.remove('hidden-screen');
};

window.toggleSidebar = (open) => {
    document.getElementById('appSidebar').classList.toggle('open', open);
    document.getElementById('sidebarOverlay').classList.toggle('hidden-screen', !open);
};

// [4. AUTH & REFERRAL]
function detectReferral() {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) {
        document.getElementById('userReferralInput').value = ref.toUpperCase();
        document.getElementById('userReferralInput').style.borderColor = "#2ecc71";
    }
}

window.showDirectLogin = () => {
    document.getElementById('keyEntryArea').classList.add('hidden-screen');
    document.getElementById('mobileEntryArea').classList.remove('hidden-screen');
};

window.verifyKey = async () => {
    const key = document.getElementById('userKey').value;
    const snap = await getDoc(doc(db, "assets", key));
    if (!snap.exists()) return showCustomAlert("Error", "गलत चाबी!", "error");
    sessionStorage.setItem('temp_coins', snap.data().value || 100);
    sessionStorage.setItem('temp_key', key);
    showDirectLogin();
};

window.saveMobile = async () => {
    const num = document.getElementById('userMobile').value;
    if (num.length !== 10) return alert("Valid number please");
    
    const userRef = doc(db, "users", num);
    const snap = await getDoc(userRef);
    const tempCoins = Number(sessionStorage.getItem('temp_coins') || 0);

    if (!snap.exists()) {
        await setDoc(userRef, { 
            mobile: num, balance: tempCoins + 1000, 
            totalEarned: tempCoins + 1000, 
            referredBy: document.getElementById('userReferralInput').value || "Direct",
            regDate: new Date().toISOString() 
        });
    } else {
        // स्मार्ट लॉगिन: सिक्के तभी जुड़ेंगे अगर चाबी नई हो
        const usedKey = await getDoc(doc(db, "users", num, "used_keys", sessionStorage.getItem('temp_key') || 'null'));
        if (!usedKey.exists() && tempCoins > 0) {
            await setDoc(userRef, { balance: snap.data().balance + tempCoins }, { merge: true });
        }
    }
    localStorage.setItem('userMobile', num);
    location.reload();
};

// [5. PROFILE & PIN]
window.updateProfile = async () => {
    const name = document.getElementById('profName').value;
    const dob = document.getElementById('profDob').value;
    const p1 = document.getElementById('profPin1').value;
    const p2 = document.getElementById('profPin2').value;

    if (!name || !dob || p1 !== p2 || p1.length !== 4) return alert("Details match nahi ho rahi");

    const userRef = doc(db, "users", mobile);
    await setDoc(userRef, { 
        userName: name, dob: dob, securityPin: p1, 
        profileComplete: true, 
        balance: (JSON.parse(sessionStorage.getItem('user_data')).balance || 0) + 500 
    }, { merge: true });
    
    showCustomAlert("Success", "Profile Verified! +500 Coins", "success");
    loadCachedDashboard(true);
};

window.forgotPin = async () => {
    const n = prompt("अपना पूरा नाम डालें:");
    const d = prompt("अपनी जन्म तिथि (YYYY-MM-DD) डालें:");
    const data = JSON.parse(sessionStorage.getItem('user_data'));
    if (n === data.userName && d === data.dob) {
        alert("आपका पिन है: " + data.securityPin);
    } else {
        alert("विवरण मेल नहीं खाते!");
    }
};

// [6. PAYMENTS & PIN LOCK]
window.processPayment = async () => {
    const pin = document.getElementById('payPin').value;
    const amount = Number(document.getElementById('payAmount').value);
    const data = JSON.parse(sessionStorage.getItem('user_data'));

    if (pin !== data.securityPin) return showCustomAlert("🔒 Error", "गलत सुरक्षा पिन!", "error");
    if (data.balance < amount) return alert("Balance kam hai");

    // Execution logic same as old, adding totalSpent increment
    const mRef = doc(db, "merchants", globalActiveMerchant.mobile);
    const uRef = doc(db, "users", mobile);
    
    await Promise.all([
        setDoc(uRef, { balance: data.balance - amount, totalSpent: (data.totalSpent || 0) + amount }, { merge: true }),
        setDoc(mRef, { balance: (globalActiveMerchant.balance || 0) + amount }, { merge: true })
    ]);
    
    showCustomAlert("Success", "भुगतान सफल!", "success");
    loadCachedDashboard(true);
    switchAppTab('home');
};

// [7. VIDEO PROMOTER]
async function fetchUnusedVideos() {
    const q = query(collection(db, "assets"), where("status", "==", "active"), limit(5));
    const snap = await getDocs(q);
    const used = await getDocs(collection(db, "users", mobile, "used_keys"));
    const usedList = used.docs.map(d => d.id);
    
    let promo = null;
    snap.forEach(d => { if (!usedList.includes(d.id)) promo = d.data(); });
    
    if (promo) {
        document.getElementById('lblPromoTitle').innerText = promo.title;
        document.getElementById('btnPromoLink').href = promo.link;
        document.getElementById('promoVideoSection').classList.remove('hidden-screen');
    }
}

// [8. SOCIAL MEDIA]
window.claimSocial = async (platform) => {
    const uRef = doc(db, "users", mobile);
    const snap = await getDoc(uRef);
    if (snap.data()['task_' + platform]) return alert("Pehle hi le chuke ho");
    
    await setDoc(uRef, { 
        balance: snap.data().balance + 1000,
        ['task_' + platform]: true 
    }, { merge: true });
    
    showCustomAlert("Jackpot!", "+1000 Coins added!", "success");
    loadCachedDashboard(true);
};

window.showCustomAlert = (t, m, type) => {
    document.getElementById('alertTitle').innerText = t;
    document.getElementById('alertMsg').innerText = m;
    document.getElementById('customAlert').classList.remove('hidden-screen');
};
window.closeAlert = () => document.getElementById('customAlert').classList.add('hidden-screen');
window.logout = () => { localStorage.clear(); location.reload(); };
