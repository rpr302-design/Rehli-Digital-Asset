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
let currentUserData = null;

window.addEventListener('DOMContentLoaded', async () => {
    if (mobile) {
        document.getElementById('dashboardContainer').classList.remove('hidden-screen');
        await syncCoreData();
        switchAppTab('home');
    } else {
        document.getElementById('authContainer').classList.remove('hidden-screen');
        checkUrlForReferral();
    }
});

// 🔗 ऑटो रेफरल डिटेक्शन
function checkUrlForReferral() {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
        const inp = document.getElementById('userReferralInput');
        inp.value = ref.toUpperCase();
        inp.style.borderColor = "var(--success)";
    }
}

// 🔄 डेटा सिंक (Wallet + Profile + Promo)
async function syncCoreData() {
    try {
        const snap = await getDoc(doc(db, "users", mobile));
        if (!snap.exists()) return logout();

        currentUserData = snap.data();
        const bal = currentUserData.balance || 0;
        const spent = currentUserData.totalSpent || 0;

        // UI Update
        document.getElementById('dashBalance').innerText = bal;
        document.getElementById('sideMenuUser').innerText = currentUserData.userName || "Guest";
        document.getElementById('sideMenuPhone').innerText = "+91 " + mobile;

        // Wallet Tab
        document.getElementById('wTotalEarned').innerText = bal + spent;
        document.getElementById('wReferEarned').innerText = currentUserData.referEarnings || 0;
        document.getElementById('wTotalSpent').innerText = spent;
        document.getElementById('wCashValue').innerText = "₹ " + (bal / 100).toFixed(2);

        // Profile Tab View
        if (currentUserData.profileBonusClaimed) {
            document.getElementById('profUpdateForm').classList.add('hidden-screen');
            document.getElementById('profStatusCard').classList.remove('hidden-screen');
            document.getElementById('sName').innerText = currentUserData.userName;
            document.getElementById('sDob').innerText = currentUserData.dob;
            document.getElementById('sWa').innerText = currentUserData.whatsapp;
        }

        await loadUnusedVideos();
    } catch (e) { console.error(e); }
}

// 📺 अन-यूज्ड वीडियो प्रमोटर
async function loadUnusedVideos() {
    const assetsRef = collection(db, "assets");
    const usedRef = collection(db, "users", mobile, "used_keys");
    
    const [allAssets, usedKeys] = await Promise.all([
        getDocs(query(assetsRef, limit(10))),
        getDocs(usedRef)
    ]);

    const usedList = usedKeys.docs.map(d => d.id);
    let promo = null;

    allAssets.forEach(d => {
        if (!usedList.includes(d.id) && !promo) promo = d.data();
    });

    if (promo) {
        document.getElementById('lblPromoTitle').innerText = promo.title;
        document.getElementById('btnPromoLink').href = promo.link;
    } else {
        document.getElementById('promoVideoSection').classList.add('hidden-screen');
    }
}

// 📁 टैब स्विचिंग (Single Frame)
window.switchAppTab = (tabId) => {
    toggleSidebar(false);
    document.querySelectorAll('.app-tab-content').forEach(t => t.classList.add('hidden-screen'));
    document.getElementById('tab-' + tabId).classList.remove('hidden-screen');
    
    // Bottom Nav Active State
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    // (Add logic to set active nav link based on tabId)
};

window.toggleSidebar = (open) => {
    document.getElementById('appSidebar').classList.toggle('open', open);
    document.getElementById('sidebarOverlay').classList.toggle('hidden-screen', !open);
};

// 👤 प्रोफाइल सेविंग (Bonus + Secure Pin)
window.saveProfileData = async () => {
    const name = document.getElementById('pName').value.trim();
    const dob = document.getElementById('pDob').value;
    const wa = document.getElementById('pWa').value.trim();
    const p1 = document.getElementById('pPin1').value;
    const p2 = document.getElementById('pPin2').value;

    if (!name || !dob || p1 !== p2 || p1.length !== 4) {
        return alert("कृपया सभी जानकारी सही भरें और पिन मैच करें!");
    }

    const userRef = doc(db, "users", mobile);
    await setDoc(userRef, {
        userName: name, dob: dob, whatsapp: wa, securityPin: p1,
        profileBonusClaimed: true,
        balance: (currentUserData.balance || 0) + 500
    }, { merge: true });

    showCustomAlert("Success 🎉", "प्रोफाइल सुरक्षित हो गई और +500 बोनस मिला!", "success");
    await syncCoreData();
};

// 🔐 पिन रिकवरी
window.verifyForRecovery = () => {
    const fN = document.getElementById('fName').value.trim();
    const fD = document.getElementById('fDob').value;

    if (fN === currentUserData.userName && fD === currentUserData.dob) {
        alert("आपका पिन है: " + currentUserData.securityPin);
        document.getElementById('pinForgetForm').classList.add('hidden-screen');
    } else {
        alert("जानकारी मैच नहीं हुई!");
    }
};

window.showPinResetForm = () => {
    document.getElementById('profStatusCard').classList.add('hidden-screen');
    document.getElementById('profUpdateForm').classList.remove('hidden-screen');
};

// 📱 सोशल मीडिया बोनस
window.claimMediaBonus = async (key, amt, link) => {
    window.open(link, '_blank');
    const taskKey = "task_" + key;
    if (currentUserData[taskKey]) return alert("आप इसे पहले ही क्लेम कर चुके हैं!");

    const userRef = doc(db, "users", mobile);
    await setDoc(userRef, {
        [taskKey]: true,
        balance: (currentUserData.balance || 0) + amt
    }, { merge: true });

    showCustomAlert("Bonus! 🎁", `+${amt} सिक्के मिले!`, "success");
    await syncCoreData();
};

// पुराने फंक्शन्स (VerifyKey, SaveMobile, ProcessDashKey, Payment) वैसे ही रहेंगे, 
// बस पेमेंट में पिन चेक `currentUserData.securityPin` से करना होगा।
