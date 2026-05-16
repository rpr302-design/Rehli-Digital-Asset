import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- ⚙️ Firebase Configuration ---
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

// --- 🌐 Global Variables ---
let html5QrcodeScanner = null;
let globalActiveMerchant = null; 
let mBoxType = 0, mDigits = 0, mReward = 0;
const mobile = localStorage.getItem('userMobile');
const todayDate = new Date().toISOString().substring(0, 10);

// --- 🚀 Initializer & Smart Gatekeeper ---
window.addEventListener('DOMContentLoaded', async () => {
    if (mobile) {
        document.getElementById('dashboardContainer').classList.remove('hidden-screen');
        document.getElementById('authContainer').classList.add('hidden-screen');
        switchAppTab('home');
        await loadCachedDashboard();
    } else {
        document.getElementById('authContainer').classList.remove('hidden-screen');
        document.getElementById('dashboardContainer').classList.add('hidden-screen');
        
        // 🔗 URL से ऑटो-रेफरल कोड डिटेक्शन (उदा. ?ref=REHLI123)
        const urlParams = new URLSearchParams(window.location.search);
        const refCode = urlParams.get('ref');
        if (refCode) {
            const refInput = document.getElementById('userReferralInput');
            if(refInput) {
                refInput.value = refCode.trim().toUpperCase();
                refInput.style.background = "#2ecc71"; 
            }
        }
    }
});

// --- 📱 UI Action Functions (Window Scope) ---

window.toggleSidebar = (open) => {
    document.getElementById('appSidebar').classList.toggle('open', open);
    document.getElementById('sidebarOverlay').classList.toggle('hidden-screen', !open);
};

window.switchAppTab = async (tabName) => {
    stopQRScanner();
    window.toggleSidebar(false);
    document.querySelectorAll('.app-tab-content').forEach(t => t.classList.add('hidden-screen'));
    
    const targetTab = document.getElementById('tab-' + tabName);
    if(targetTab) targetTab.classList.remove('hidden-screen');
    
    // नेविगेशन एक्टिव स्टेट
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const currentNav = document.getElementById('nav-' + tabName);
    if(currentNav) currentNav.classList.add('active');
    
    if (tabName === 'wallet') await updateWalletSheet();
    if (tabName === 'profile') await loadProfileStatus();
};

window.showCustomAlert = (title, msg, type) => {
    document.getElementById('alertTitle').innerText = title;
    document.getElementById('alertMsg').innerText = msg;
    const iconEl = document.getElementById('alertIcon');
    iconEl.innerText = type === 'success' ? '🎉' : '❌';
    iconEl.style.color = type === 'success' ? 'var(--success)' : 'var(--danger)';
    document.getElementById('customAlert').classList.remove('hidden-screen');
};

window.closeAlert = () => {
    document.getElementById('customAlert').classList.add('hidden-screen');
};

window.showDirectLogin = () => {
    sessionStorage.removeItem('temp_key');
    sessionStorage.removeItem('temp_coins');
    document.getElementById('keySection').classList.add('hidden-screen');
    document.getElementById('rewardSection').classList.remove('hidden-screen');
    
    const header = document.getElementById('loginHeaderTitle');
    if(header) header.innerHTML = `<h2 style="color:#fff;">Welcome Back!</h2><p style="color:#fff; font-size:12px;">अपना नंबर डालकर अकाउंट खोलें</p>`;
    
    document.getElementById('lblRefTag').style.display = 'none';
    document.getElementById('userReferralInput').style.display = 'none';
    document.getElementById('btnFinalAuth').innerText = "अकाउंट लॉगिन करें";
};

// --- 🔑 Authentication & Keys Logic ---

window.verifyKey = async () => {
    const key = document.getElementById('userKey').value.trim();
    if (key.length !== 5) return window.showCustomAlert("अमान्य ❌", "5 अंकों की सही चाबी डालें।", "error");

    try {
        const assetSnap = await getDoc(doc(db, "assets", key));
        if (!assetSnap.exists()) return window.showCustomAlert("गलत चाबी ❌", "यह चाबी मान्य नहीं है!", "error");

        sessionStorage.setItem('temp_key', key);
        sessionStorage.setItem('temp_coins', assetSnap.data().value || 100);

        document.getElementById('keySection').classList.add('hidden-screen');
        document.getElementById('rewardSection').classList.remove('hidden-screen');
    } catch (e) { window.showCustomAlert("Error", "सर्वर एरर!", "error"); }
};

window.saveMobile = async () => {
    const inputMobile = document.getElementById('userMobile').value.trim();
    const refCodeUsed = document.getElementById('userReferralInput').value.trim();
    const savedKey = sessionStorage.getItem('temp_key');
    const savedCoins = Number(sessionStorage.getItem('temp_coins') || 0);

    if (inputMobile.length !== 10) return window.showCustomAlert("त्रुटि ❌", "कृपया सही मोबाइल नंबर डालें!", "error");

    try {
        const userRef = doc(db, "users", inputMobile);
        const userSnap = await getDoc(userRef);

        if (!savedKey) { // Direct Login Mode
            if (userSnap.exists()) {
                localStorage.setItem('userMobile', inputMobile);
                window.showCustomAlert("लॉगिन सफल 👋", "स्वागत है!", "success");
                setTimeout(() => location.reload(), 1500);
            } else {
                window.showCustomAlert("खाता नहीं मिला ❌", "कृपया पहले चाबी से अकाउंट बनाएं।", "error");
            }
            return;
        }

        if (!userSnap.exists()) { // New Registration
            let welcomeCoins = savedCoins + 1000;
            await setDoc(userRef, { mobile: inputMobile, balance: welcomeCoins, userName: "नया यूजर", referredBy: refCodeUsed || "Direct", regDate: new Date().toISOString() });
            await setDoc(doc(db, "users", inputMobile, "used_keys", savedKey), { key: savedKey, amount: savedCoins, claimedAt: new Date().toISOString() });
            localStorage.setItem('userMobile', inputMobile);
            document.getElementById('winSound').play();
            window.showCustomAlert("बधाई हो! 🎉", `+1000 बोनस और +${savedCoins} सिक्के क्रेडिट!`, "success");
        } else { // Existing user with Key
            const isFresh = await checkKeyMonthLock(inputMobile, savedKey);
            if (isFresh) {
                const newBal = (userSnap.data().balance || 0) + savedCoins;
                await setDoc(userRef, { balance: newBal }, { merge: true });
                await setDoc(doc(db, "users", inputMobile, "used_keys", savedKey), { key: savedKey, amount: savedCoins, claimedAt: new Date().toISOString() });
                window.showCustomAlert("सफलता 🎉", `+${savedCoins} सिक्के जुड़ गए।`, "success");
            }
            localStorage.setItem('userMobile', inputMobile);
        }
        sessionStorage.removeItem('temp_key');
        setTimeout(() => location.reload(), 2000);
    } catch (e) { window.showCustomAlert("Error", "प्रोसेसिंग विफल!", "error"); }
};

// --- 👤 Profile & Pin Management ---

window.submitProfile = async () => {
    const name = document.getElementById('profName').value;
    const dob = document.getElementById('profDOB').value;
    const pin = document.getElementById('profPin').value;
    const gender = document.getElementById('profGender').value;

    if (!name || !dob || pin.length !== 4) return window.showCustomAlert("त्रुटि", "सभी जानकारी भरें!");

    try {
        const userRef = doc(db, "users", mobile);
        const snap = await getDoc(userRef);
        let newBal = snap.data().balance || 0;
        if(!snap.data().profileCompleted) newBal += 500;

        await setDoc(userRef, {
            userName: name, dob: dob, gender: gender, securityPin: pin,
            balance: newBal, profileCompleted: true
        }, { merge: true });

        window.showCustomAlert("सफल!", "प्रोफाईल सुरक्षित कर दी गई है।", "success");
        switchAppTab('profile');
    } catch(e) { console.error(e); }
};

window.handlePinUpdate = async () => {
    const userRef = doc(db, "users", mobile);
    const snap = await getDoc(userRef);
    const data = snap.data();
    const oldVal = document.getElementById('oldPinOrName').value;
    const dobRec = document.getElementById('recoveryDOB').value;
    const newP = document.getElementById('newPin').value;

    if(newP.length !== 4) return window.showCustomAlert("Error", "नया पिन 4 अंकों का होना चाहिए।", "error");

    if (!document.getElementById('recoveryDOB').classList.contains('hidden-screen')) { // Recovery Mode
        if (oldVal === data.userName && dobRec === data.dob) {
            await setDoc(userRef, { securityPin: newP }, { merge: true });
            window.showCustomAlert("सफल", "पिन रिकवर हो गया!", "success");
            switchAppTab('profile');
        } else {
            window.showCustomAlert("गलत विवरण", "डेटा मैच नहीं हुआ।", "error");
        }
    } else { // Normal Change Mode
        if (oldVal === data.securityPin) {
            await setDoc(userRef, { securityPin: newP }, { merge: true });
            window.showCustomAlert("सफल", "पिन अपडेट हो गया!", "success");
            switchAppTab('profile');
        } else {
            window.showCustomAlert("गलत पिन", "पुराना पिन सही नहीं है।", "error");
        }
    }
};

// --- 💸 Payment Engine (Paytm Style) ---

window.searchMerchant = async () => {
    const inputNum = document.getElementById('payMerchantMobile').value.trim();
    if (inputNum.length !== 10) return window.showCustomAlert("Error ❌", "10 अंकों का नंबर डालें।", "error");
    
    try {
        const mSnap = await getDoc(doc(db, "merchants", inputNum));
        if (!mSnap.exists()) {
            globalActiveMerchant = null;
            return window.showCustomAlert("Not Found ❌", "दुकानदार पंजीकृत नहीं है।", "error");
        }
        globalActiveMerchant = mSnap.data();
        document.getElementById('lblVerifiedShopName').innerText = globalActiveMerchant.shopName;
        document.getElementById('merchantVerifyArea').classList.remove('hidden-screen');
        document.getElementById('paymentFormArea').classList.remove('hidden-screen');
    } catch (e) { console.error(e); }
};

window.processPayment = async () => {
    if (!globalActiveMerchant) return;
    
    const amt = Number(document.getElementById('payAmount').value);
    const bill = Number(document.getElementById('payBillAmount').value);
    const pin = document.getElementById('paySecurityPin').value.trim();

    if (!amt || !bill || pin.length !== 4) return window.showCustomAlert("त्रुटि", "सभी जानकारी और पिन भरें!", "error");

    try {
        const userRef = doc(db, "users", mobile);
        const userSnap = await getDoc(userRef);
        const uData = userSnap.data();

        if (pin !== uData.securityPin) return window.showCustomAlert("गलत पिन", "सिक्योरिटी पिन मैच नहीं हुआ।", "error");
        if ((uData.balance || 0) < amt) return window.showCustomAlert("लो बैलेंस", "पर्याप्त सिक्के नहीं हैं।", "error");

        const newTx = doc(collection(db, "merchant_transactions"));
        await Promise.all([
            setDoc(userRef, { balance: uData.balance - amt }, { merge: true }),
            setDoc(doc(db, "merchants", globalActiveMerchant.mobile), { balance: (globalActiveMerchant.balance || 0) + amt }, { merge: true }),
            setDoc(newTx, { txId: newTx.id, userMobile: mobile, merchantMobile: globalActiveMerchant.mobile, amount: amt, timestamp: new Date().toISOString() })
        ]);

        window.showCustomAlert("भुगतान सफल! 💸", `${amt} एसेट्स भेज दिए गए।`, "success");
        switchAppTab('home');
        await loadCachedDashboard(true);
    } catch (e) { window.showCustomAlert("Error", "भुगतान फेल हुआ!", "error"); }
};

// --- 💰 Utility & Helper Functions ---

async function checkKeyMonthLock(userMobile, key) {
    const snap = await getDoc(doc(db, "users", userMobile, "used_keys", key));
    if (snap.exists() && snap.data().claimedAt) {
        const diff = Math.abs(new Date() - new Date(snap.data().claimedAt));
        if (Math.ceil(diff / (1000 * 60 * 60 * 24)) <= 30) return false;
    }
    return true;
}

async function loadCachedDashboard(force = false) {
    const cName = sessionStorage.getItem('cash_name');
    const cBal = sessionStorage.getItem('cash_balance');
    if (cName && cBal && !force) {
        renderDashboardUI(cName, cBal);
    } else {
        const snap = await getDoc(doc(db, "users", mobile));
        if (snap.exists()) {
            sessionStorage.setItem('cash_name', snap.data().userName || "यूज़र");
            sessionStorage.setItem('cash_balance', snap.data().balance || 0);
            renderDashboardUI(snap.data().userName || "यूज़र", snap.data().balance || 0);
        }
    }
}

async function updateWalletSheet() {
    const userSnap = await getDoc(doc(db, "users", mobile));
    const txSnap = await getDocs(query(collection(db, "merchant_transactions"), where("userMobile", "==", mobile)));
    let spent = 0;
    txSnap.forEach(d => spent += (d.data().amount || 0));
    const bal = userSnap.data().balance || 0;
    
    document.getElementById('wTotalEarned').innerText = bal + spent;
    document.getElementById('wTotalSpent').innerText = spent;
    document.getElementById('wSpentValue').innerText = "₹ " + (spent / 20).toFixed(2);
}

// --- 🚪 Logout ---
window.logout = () => {
    localStorage.removeItem('userMobile');
    sessionStorage.clear();
    location.reload();
};
