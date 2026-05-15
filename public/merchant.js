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

window.addEventListener('DOMContentLoaded', async () => {
    if (currentMerchantMobile) {
        showDashboard();
    }
});

window.toggleAuth = (showRegister) => {
    document.getElementById('loginForm').classList.toggle('hidden', showRegister);
    document.getElementById('registerForm').classList.toggle('hidden', !showRegister);
    document.getElementById('authTitle').innerText = showRegister ? "नया दुकानदार रजिस्ट्रेशन" : "दुकानदार लॉगिन (Merchant Login)";
};

// 🏪 दुकानदार रजिस्ट्रेशन लॉजिक (पेज रिस्पॉन्स फिक्स)
window.merchantRegister = async () => {
    // फॉर्म के सभी इनपुट्स की वैल्यू उठाना
    const name = document.getElementById('regShopName').value.trim();
    const address = document.getElementById('regAddress').value.trim();
    const mobile = document.getElementById('regMobile').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const pass = document.getElementById('regPass').value;

    // वैलिडेशन चेक (यदि कोई भी फील्ड खाली है तो अलर्ट आएगा)
    if (!name || !address || !mobile || !email || !pass) {
        alert("कृपया सभी जानकारी भरें! (Please fill all fields)");
        return;
    }

    if (mobile.length !== 10) {
        alert("मोबाइल नंबर पूरा 10 अंकों का होना चाहिए!");
        return;
    }

    try {
        // फायरबेस में मर्चेंट रेफरेंस चेक करना
        const mRef = doc(db, "merchants", mobile);
        const mSnap = await getDoc(mRef);

        if (mSnap.exists()) {
            alert("यह मोबाइल नंबर पहले से रजिस्टर्ड है! (Mobile already registered)");
            return;
        }

        // फायरबेस डेटाबेस में नया डॉक्यूमेंट सेव करना
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
        
        // रजिस्ट्रेशन सफल होने के बाद ऑटोमैटिक लॉगिन फॉर्म पर वापस भेजें
        toggleAuth(false);
        
        // इनपुट बॉक्स साफ करना
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

    try {
        const mSnap = await getDoc(doc(db, "merchants", mobile));
        if (mSnap.exists() && mSnap.data().password === pass) {
            localStorage.setItem('merchantMobile', mobile);
            currentMerchantMobile = mobile;
            showDashboard();
        } else {
            alert("गलत मोबाइल नंबर या पासवर्ड!");
        }
    } catch (e) { alert("लॉगिन एरर!"); }
};

// 📊 डैशबोर्ड और रीयल-टाइम डेटा लोड (सिर्फ 5 यूजर का डेटा)
async function showDashboard() {
    document.getElementById('merchantAuthSection').classList.add('hidden');
    document.getElementById('merchantDashboard').classList.remove('hidden');

    try {
        const mSnap = await getDoc(doc(db, "merchants", currentMerchantMobile));
        if (mSnap.exists()) {
            const data = mSnap.data();
            document.getElementById('lblShopName').innerText = data.shopName;
            document.getElementById('lblMerchantPhone').innerText = "Shop ID: +91 " + data.mobile;
            document.getElementById('lblMerchantBalance').innerText = data.balance || 0;
            
            // इनपुट बॉक्स में वर्तमान रूल्स सेट करना
            document.getElementById('setPerTxnLimit').value = data.perTxnLimit || 5000;
            document.getElementById('setMonthlyLimit').value = data.monthlyLimit || 20000;
            document.getElementById('setMinBill').value = data.minBillAmount || 100;

            // 🔲 डायनामिक क्यूआर कोड जनरेशन (गूगल चार्ट एपीआई का उपयोग करके)
            // क्यूआर कोड में दुकान का मोबाइल नंबर छुपा रहेगा
            const qrUrl = `https://chart.googleapis.com/chart?chs=160x160&cht=qr&chl=${encodeURIComponent("REHLI-PAY:" + data.mobile)}&choe=UTF-8`;
            document.getElementById('shopQrImg').src = qrUrl;

            // 📋 सिर्फ हालिया 5 ट्रांजैक्शन लोड करना
            await loadRecentTransactions();
        }
    } catch (e) { console.error(e); }
}

async function loadRecentTransactions() {
    const txBody = document.getElementById('merchantTxBody');
    try {
        const q = query(
            collection(db, "merchant_transactions"),
            where("merchantMobile", "==", currentMerchantMobile),
            orderBy("timestamp", "desc"),
            limit(50) // पहले मर्चेंट के सारे लोड करें, फिर लूप में सिर्फ 5 रेंडर करेंगे
        );
        
        const snap = await getDocs(q);
        if (snap.empty) return;

        txBody.innerHTML = "";
        let count = 0;
        
        snap.forEach(docSnap => {
            if (count < 5) { // सख्त पाबंदी: एक बार में केवल 5 यूजर्स का ही डेटा दिखाए
                const tx = docSnap.data();
                const dateStr = tx.timestamp ? tx.timestamp.substring(0,10) : '-';
                txBody.innerHTML += `<tr><td><b>+91 ${tx.userMobile}</b></td><td style="color:#2ecc71; font-weight:600;">+${tx.amount} এसेट</td><td>${dateStr}</td></tr>`;
                count++;
            }
        });
    } catch (e) { console.error("Tx Load Error:", e); }
}

// ⚙️ बिजनेस रूल्स/लिमिट सेव करना
window.saveMerchantRules = async () => {
    const perTxn = document.getElementById('setPerTxnLimit').value;
    const monthly = document.getElementById('setMonthlyLimit').value;
    const minBill = document.getElementById('setMinBill').value;

    try {
        await setDoc(doc(db, "merchants", currentMerchantMobile), {
            perTxnLimit: Number(perTxn),
            monthlyLimit: Number(monthly),
            minBillAmount: Number(minBill)
        }, { merge: true });

        alert("व्यापार नियम सफलतापूर्वक अपडेट हो गए हैं! ✅");
        location.reload();
    } catch (e) { alert("सेव करने में एरर आया!"); }
};

window.merchantLogout = () => {
    localStorage.removeItem('merchantMobile');
    location.reload();
};
