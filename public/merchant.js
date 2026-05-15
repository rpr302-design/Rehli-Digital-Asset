import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

let currentMerchantMobile = localStorage.getItem('merchantMobile');

// पेज लोड होते ही लॉगिन स्टेटस चेक करें
window.addEventListener('DOMContentLoaded', async () => {
    if (currentMerchantMobile) {
        window.showDashboard();
    }
});

// लॉगिन और रजिस्ट्रेशन फॉर्म के बीच स्विच करने के लिए
window.toggleAuth = (showRegister) => {
    document.getElementById('loginForm').classList.toggle('hidden', showRegister);
    document.getElementById('registerForm').classList.toggle('hidden', !showRegister);
    document.getElementById('authTitle').innerText = showRegister ? "नया दुकानदार रजिस्ट्रेशन" : "दुकानदार लॉगिन (Merchant Login)";
};

// 🏪 दुकानदार रजिस्ट्रेशन लॉजिक (फिक्स्ड और टेस्टेड)
window.merchantRegister = async () => {
    const name = document.getElementById('regShopName').value.trim();
    const address = document.getElementById('regAddress').value.trim();
    const mobile = document.getElementById('regMobile').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const pass = document.getElementById('regPass').value;

    if (!name || !address || !mobile || !email || !pass) {
        alert("कृपया सभी जानकारी भरें! (Please fill all fields)");
        return;
    }

    if (mobile.length !== 10) {
        alert("मोबाइल नंबर पूरा 10 अंकों का होना चाहिए!");
        return;
    }

    try {
        const mRef = doc(db, "merchants", mobile);
        const mSnap = await getDoc(mRef);

        if (mSnap.exists()) {
            alert("यह मोबाइल नंबर पहले से रजिस्टर्ड है! (Mobile already registered)");
            return;
        }

        await setDoc(mRef, {
            shopName: name,
            address: address,
            mobile: mobile,
            email: email,
            password: pass,
            balance: 0,
            perTxnLimit: 5000, 
            monthlyLimit: 20000, 
            minBillAmount: 100,
            regDate: new Date().toISOString()
        });

        alert("बधाई हो! दुकानदार रजिस्ट्रेशन सफल रहा। ✅\nअब आप लॉगिन कर सकते हैं।");
        
        window.toggleAuth(false);
        
        document.getElementById('regShopName').value = "";
        document.getElementById('regAddress').value = "";
        document.getElementById('regMobile').value = "";
        document.getElementById('regEmail').value = "";
        document.getElementById('regPass').value = "";

    } catch (e) { 
        console.error("Registration Error: ", e);
        alert("रजिस्ट्रेशन फेल हुआ: " + e.message); 
    }
};

// 🔑 दुकानदार लॉगिन
window.merchantLogin = async () => {
    const mobile = document.getElementById('loginMobile').value.trim();
    const pass = document.getElementById('loginPass').value;

    if (!mobile || !pass) {
        alert("कृपया मोबाइल नंबर और पासवर्ड दर्ज करें!");
        return;
    }

    try {
        const mSnap = await getDoc(doc(db, "merchants", mobile));
        if (mSnap.exists() && mSnap.data().password === pass) {
            localStorage.setItem('merchantMobile', mobile);
            currentMerchantMobile = mobile;
            window.showDashboard();
        } else {
            alert("गलत मोबाइल नंबर या पासवर्ड!");
        }
    } catch (e) { 
        console.error("Login Error: ", e);
        alert("लॉगिन एरर!"); 
    }
};

// 📊 डैशबोर्ड लोड करना (window स्कोप फिक्स)
window.showDashboard = async () => {
    document.getElementById('merchantAuthSection').classList.add('hidden');
    document.getElementById('merchantDashboard').classList.remove('hidden');

    try {
        const mSnap = await getDoc(doc(db, "merchants", currentMerchantMobile));
        if (mSnap.exists()) {
            const data = mSnap.data();
            document.getElementById('lblShopName').innerText = data.shopName;
            document.getElementById('lblMerchantPhone').innerText = "Shop ID: +91 " + data.mobile;
            document.getElementById('lblMerchantBalance').innerText = data.balance || 0;
            
            document.getElementById('setPerTxnLimit').value = data.perTxnLimit || 5000;
            document.getElementById('setMonthlyLimit').value = data.monthlyLimit || 20000;
            document.getElementById('setMinBill').value = data.minBillAmount || 100;

            // 🔲 डायनामिक क्यूआर कोड जनरेशन
            const qrUrl = `https://chart.googleapis.com/chart?chs=160x160&cht=qr&chl=${encodeURIComponent("REHLI-PAY:" + data.mobile)}&choe=UTF-8`;
            document.getElementById('shopQrImg').src = qrUrl;

            // ट्रांजैक्शन लोड करना
            await loadRecentTransactions();
        }
    } catch (e) { console.error("Dashboard Load Error: ", e); }
};

// 📋 हालिया 5 ट्रांजैक्शन लोड करने का सख्त नियम
async function loadRecentTransactions() {
    const txBody = document.getElementById('merchantTxBody');
    try {
        const q = query(
            collection(db, "merchant_transactions"),
            where("merchantMobile", "==", currentMerchantMobile),
            orderBy("timestamp", "desc"),
            limit(5)
        );
        
        const snap = await getDocs(q);
        if (snap.empty) {
            txBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#999;">कोई लेनदेन नहीं मिला।</td></tr>`;
            return;
        }

        txBody.innerHTML = "";
        
        snap.forEach(docSnap => {
            const tx = docSnap.data();
            const dateStr = tx.timestamp ? tx.timestamp.substring(0,10) : '-';
            txBody.innerHTML += `<tr>
                <td><b>+91 ${tx.userMobile}</b></td>
                <td style="color:#2ecc71; font-weight:600;">+${tx.amount} एसेट</td>
                <td>${dateStr}</td>
            </tr>`;
        });
    } catch (e) { 
        console.error("Tx Load Error:", e); 
    }
}

// ⚙️ बिजनेस रूल्स/लिमिट सेव करना
window.saveMerchantRules = async () => {
    const perTxn = document.getElementById('setPerTxnLimit').value;
    const monthly = document.getElementById('setMonthlyLimit').value;
    const minBill = document.getElementById('setMinBill').value;

    if (!perTxn || !monthly || !minBill) {
        alert("कृपया सभी लिमिट फील्ड भरें!");
        return;
    }

    try {
        await setDoc(doc(db, "merchants", currentMerchantMobile), {
            perTxnLimit: Number(perTxn),
            monthlyLimit: Number(monthly),
            minBillAmount: Number(minBill)
        }, { merge: true });

        alert("व्यापार नियम सफलतापूर्वक अपडेट हो गए हैं! ✅");
        location.reload();
    } catch (e) { 
        alert("सेव करने में एरर आया!"); 
    }
};

// दुकानदार लॉगआउट
window.merchantLogout = () => {
    localStorage.removeItem('merchantMobile');
    location.reload();
};
