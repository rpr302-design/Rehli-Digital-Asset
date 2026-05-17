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

// Global Variables
let html5QrcodeScanner = null;
let globalActiveMerchant = null; 
let mBoxType = 0, mDigits = 0, mReward = 0;
const mobile = localStorage.getItem('userMobile');
const todayDate = new Date().toISOString().substring(0, 10);

// --- 🎯 [ऐप इनिशियलाइजेशन] ---
window.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');

    if (mobile) {
        showScreen('dashboardContainer');
        await loadCachedDashboard();
    } else {
        showScreen('authContainer');
        if (refCode) {
            const refInput = document.getElementById('userReferralInput');
            if(refInput) {
                refInput.value = refCode.trim().toUpperCase();
                refInput.style.background = "#d4edda"; 
            }
        }
    }
});

function showScreen(id) {
    document.getElementById('dashboardContainer').classList.add('hidden-screen');
    document.getElementById('authContainer').classList.add('hidden-screen');
    document.getElementById(id).classList.remove('hidden-screen');
}

// --- 🔒 [डैशबोर्ड और कैशिंग] ---
async function loadCachedDashboard(forceRefresh = false) {
    const cName = sessionStorage.getItem('cash_name');
    const cBal = sessionStorage.getItem('cash_balance');

    if (cName && cBal && !forceRefresh) {
        renderDashboardUI(cName, cBal);
        renderCachedPromoVideo();
    } else {
        try {
            const userSnap = await getDoc(doc(db, "users", mobile));
            if (userSnap.exists()) {
                const data = userSnap.data();
                const name = data.userName || "यूज़र";
                const balance = data.balance || 0;
                
                sessionStorage.setItem('cash_name', name);
                sessionStorage.setItem('cash_balance', balance);
                
                renderDashboardUI(name, balance);
                await fetchAndCachePromoVideo();
            } else {
                window.logout();
            }
        } catch (e) { console.error("Dashboard Load Error:", e); }
    }
}

function renderDashboardUI(name, balance) {
    const els = {
        'dashUserName': `नमस्ते, ${name}! 👋`,
        'dashUserPhone': "+91 " + mobile,
        'dashBalance': balance,
        'sideMenuUser': name,
        'sideMenuPhone': "+91 " + mobile
    };
    for (let id in els) {
        const el = document.getElementById(id);
        if(el) el.innerText = els[id];
    }
}

// --- 📱 [टैब और साइडबार] ---
window.toggleSidebar = (open) => {
    document.getElementById('appSidebar').classList.toggle('open', open);
    document.getElementById('sidebarOverlay').classList.toggle('hidden-screen', !open);
};

window.switchAppTab = async (tabName) => {
    window.toggleSidebar(false);
    document.querySelectorAll('.app-tab-content').forEach(t => t.classList.add('hidden-screen'));
    const target = document.getElementById('tab-' + tabName);
    if(target) target.classList.remove('hidden-screen');
    
    if (tabName === 'wallet') updateWalletSheet();
    if (tabName === 'profile') loadProfileScreen();
};

// --- 👤 [प्रोफाइल मैनेजमेंट] ---
async function loadProfileScreen() {
    try {
        const userSnap = await getDoc(doc(db, "users", mobile));
        const uData = userSnap.data();
        const isComp = uData.profileCompleted || false;

        document.getElementById('profileFormArea').classList.toggle('hidden-screen', isComp);
        document.getElementById('profileStatusArea').classList.toggle('hidden-screen', !isComp);

        if (isComp) {
            document.getElementById('stName').innerText = uData.userName;
            document.getElementById('stDOB').innerText = uData.dob || "Not Set";
            document.getElementById('stWhatsapp').innerText = uData.whatsapp || mobile;
        }
    } catch (e) { console.error(e); }
}

window.saveFullProfile = async () => {
    const name = document.getElementById('pName').value.trim();
    const dob = document.getElementById('pDOB').value;
    const pin = document.getElementById('pPin').value;
    const conf = document.getElementById('pPinConfirm').value;

    if (!name || !dob || pin.length !== 4) return showCustomAlert("त्रुटि", "सभी जानकारी भरें!");
    if (pin !== conf) return showCustomAlert("Error", "पिन मैच नहीं हुआ!");

    try {
        const userRef = doc(db, "users", mobile);
        const snap = await getDoc(userRef);
        let currentBal = snap.data().balance || 0;
        
        if(!snap.data().profileCompleted) currentBal += 500;

        await setDoc(userRef, {
            userName: name, dob: dob, securityPin: pin, whatsapp: mobile,
            balance: currentBal, profileCompleted: true
        }, { merge: true });

        sessionStorage.setItem('cash_name', name);
        sessionStorage.setItem('cash_balance', currentBal);
        
        showCustomAlert("सफल!", "प्रोफाइल सुरक्षित हुई और बोनस मिला!", "success");
        renderDashboardUI(name, currentBal);
        loadProfileScreen();
    } catch(e) { showCustomAlert("Error", "सेव करने में विफल!"); }
};

// --- 💸 [पेमेंट गेटवे (Paytm Style)] ---
window.searchMerchant = async () => {
    const inputNum = document.getElementById('payMerchantMobile').value.trim();
    if (inputNum.length !== 10) return showCustomAlert("Error", "सही नंबर डालें।");
    
    try {
        const mSnap = await getDoc(doc(db, "merchants", inputNum));
        if (!mSnap.exists()) return showCustomAlert("Error", "मर्चेंट नहीं मिला।");
        
        globalActiveMerchant = mSnap.data();
        document.getElementById('lblVerifiedShopName').innerText = globalActiveMerchant.shopName;
        document.getElementById('merchantVerifyArea').classList.remove('hidden-screen');
        document.getElementById('paymentFormArea').classList.remove('hidden-screen');
    } catch(e) { console.error(e); }
};

window.processPayment = async () => {
    const payAmount = Number(document.getElementById('payAmount').value);
    const inputPin = document.getElementById('paySecurityPin').value.trim();

    if (!payAmount || inputPin.length !== 4) return showCustomAlert("त्रुटि", "पिन और राशि भरें");

    try {
        const userRef = doc(db, "users", mobile);
        const userSnap = await getDoc(userRef);
        const uData = userSnap.data();

        if (uData.securityPin !== inputPin) return showCustomAlert("Error", "गलत पिन!");
        if (uData.balance < payAmount) return showCustomAlert("Error", "अपर्याप्त बैलेंस!");

        const newBalance = uData.balance - payAmount;
        
        // ट्रांजैक्शन अपडेट
        await setDoc(userRef, { balance: newBalance }, { merge: true });
        // (यहाँ मर्चेंट बैलेंस और ट्रांजैक्शन हिस्ट्री का सेट डॉक भी आएगा जैसा आपके पुराने कोड में था)

        sessionStorage.setItem('cash_balance', newBalance);
        renderDashboardUI(uData.userName, newBalance);
        showCustomAlert("सफल", "भुगतान हो गया!", "success");
        window.switchAppTab('home');
    } catch(e) { showCustomAlert("Error", "भुगतान फेल!"); }
};

// --- 🔗 [यूटिलिटी फंक्शन्स] ---
window.showCustomAlert = (title, msg, type = 'error') => {
    document.getElementById('alertTitle').innerText = title;
    document.getElementById('alertMsg').innerText = msg;
    const icon = document.getElementById('alertIcon');
    icon.innerText = type === 'success' ? '🎉' : '❌';
    document.getElementById('customAlert').classList.remove('hidden-screen');
};

window.closeAlert = () => document.getElementById('customAlert').classList.add('hidden-screen');

window.logout = () => {
    localStorage.removeItem('userMobile');
    sessionStorage.clear();
    location.reload();
};

// --- 🎥 [प्रोमो वीडियो लॉजिक] ---
async function fetchAndCachePromoVideo() {
    try {
        const q = query(collection(db, "assets"), where("status", "==", "active"), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
            const asset = snap.docs[0].data();
            localStorage.setItem('promo_title', asset.title);
            localStorage.setItem('promo_link', asset.link);
            renderCachedPromoVideo();
        }
    } catch (e) {}
}

function renderCachedPromoVideo() {
    const title = localStorage.getItem('promo_title');
    if (title) {
        document.getElementById('lblPromoTitle').innerText = title;
        document.getElementById('promoVideoSection').classList.remove('hidden-screen');
    }
}
