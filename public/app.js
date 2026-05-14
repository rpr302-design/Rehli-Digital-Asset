import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// चाबी वेरिफिकेशन
window.verifyKey = async () => {
    const key = document.getElementById('userKey').value;
    if (key.length !== 5) {
        alert("कृपया 5 अंकों की सही चाबी डालें।");
        return;
    }

    try {
        const docRef = doc(db, "assets", key);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const amount = docSnap.data().value || 100;
            
            // 1. साउंड बजाएं
            document.getElementById('winSound').play();

            // 2. UI बदलें
            document.getElementById('keySection').style.display = 'none';
            document.getElementById('rewardSection').style.display = 'block';
            document.getElementById('winAmount').innerText = amount + " COINS";
            
        } else {
            alert("गलत चाबी! कृपया वीडियो फिर से देखें।");
        }
    } catch (error) {
        console.error(error);
        alert("सर्वर एरर!");
    }
};

window.showMobileInput = () => {
    document.getElementById('claimBtn').style.display = 'none';
    document.getElementById('mobileBox').style.display = 'block';
};

window.saveMobile = () => {
    const mobile = document.getElementById('userMobile').value;
    if (mobile && mobile.length >= 10) {
        localStorage.setItem('userMobile', mobile);
        alert("सफलता! रिवॉर्ड आपके खाते में जोड़ दिया गया है।");
        location.reload();
    } else {
        alert("कृपया सही मोबाइल नंबर डालें।");
    }
};
