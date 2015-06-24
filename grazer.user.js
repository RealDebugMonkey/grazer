// ==UserScript==
// @name         grazer
// @namespace    https://github.com/RealDebugMonkey/grazer
// @updateURL    https://github.com/RealDebugMonkey/grazer/raw/Test/grazer.user.js
// @downloadURL  https://github.com/RealDebugMonkey/grazer/raw/Test/grazer.user.js
// @contributer  The White Light -- You rock the maths.
// @version      0.20.0
// @description  Acid Grazer
// @author       DebugMonkey
// @match        http://agar.io
// @match        https://agar.io
// @require      https://cdnjs.cloudflare.com/ajax/libs/lodash.js/3.9.3/lodash.min.js
// @user-agent   Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.13 (KHTML, like Gecko)
// @grant        none
// ==/UserScript==
console.log("Grazer starting");

//      G - user Ids
//      p - user Points
//      A - nodes by ID
//      v - items
//      s$$0 - websocket
//      D - nx
//      F - ny
//
$.getScript("https://cdnjs.cloudflare.com/ajax/libs/lodash.js/3.9.3/lodash.min.js");
(function (g, m) {

    function getWebSocket(){return s$$0;}
    function getMyIDs(){return G;}
    function getMyPoints(){return p;}
    function getNodes(){return A;}
    function getItems(){return v;}
    function getBlobNx(){return "D";}
    function getBlobNy(){return "F";}

    var isGrazing = false;
    var grazingTargetID;
    var Large = 1.25;

    // ======================   Utility code    ==================================================================
    function getSelectedBlob(){
        return getMyPoints()[0];
    }
    function isPlayerAlive(){
        return !!getMyPoints().length;
    }
    function sendMouseUpdate(ws, mouseX2,mouseY2) {

        if (ws != null && ws.readyState == ws.OPEN) {
            z0 = new ArrayBuffer(21);
            z1 = new DataView(z0);
            z1.setUint8(0, 16);
            z1.setFloat64(1, mouseX2, true);
            z1.setFloat64(9, mouseY2, true);
            z1.setUint32(17, 0, true);
            ws.send(z0);
        }
    }
    function getMass(x){
        return x*x/100
    }
    function lineDistance( point1, point2 ){
        var xs = point2[getBlobNx()] - point1[getBlobNx()];
        var ys = point2[getBlobNy()] - point1[getBlobNy()];

        return Math.sqrt( xs * xs + ys * ys );
    }

    // ======================   Grazing code    ==================================================================


    function checkCollision(myBlob, targetBlob, potential){
        // Calculate distance to target
        var dtt = lineDistance(myBlob, targetBlob);
        // Slope and normal slope
        var sl = (targetBlob[getBlobNy()]-myBlob[getBlobNy()])/(targetBlob[getBlobNx()]-myBlob[getBlobNx()]);
        var ns = -1/sl;
        // y-int of ptt
        var yint1 = myBlob[getBlobNy()] - myBlob[getBlobNx()]*sl;
        if(!lineDistance(myBlob, potential) < dtt){
            // get second y-int
            var yint2 = potential[getBlobNy()] - potential[getBlobNx()] * ns;
            var interx = (yint2-yint1)/(sl-ns);
            var intery = sl*interx + yint1;
            var pseudoblob = {"D": interx, "F": intery};
            if (((targetBlob[getBlobNx()] < myBlob[getBlobNx()] && targetBlob[getBlobNx()] < interx && interx < myBlob[getBlobNx()]) ||
                (targetBlob[getBlobNx()] > myBlob[getBlobNx()] && targetBlob[getBlobNx()] > interx && interx > myBlob[getBlobNx()])) &&
                ((targetBlob[getBlobNy()] < myBlob[getBlobNy()] && targetBlob[getBlobNy()] < intery && intery < myBlob[getBlobNy()]) ||
                (targetBlob[getBlobNy()] > myBlob[getBlobNy()] && targetBlob[getBlobNy()] > intery && intery > myBlob[getBlobNy()]))){
                if(lineDistance(potential, pseudoblob) < potential.size+100){
                    return true;
                }
            }
        }
        return false;
    }
    function isSafeTarget(myBlob, targetBlob, threats){

        var isSafe = true;
        // check target against each enemy to make sure no collision is possible
        threats.forEach(function (threat){
            if(isSafe) {
                if(threat.d) {
                    //todo once we are big enough, our center might still be far enough
                    // away that it doesn't cross virus but we still pop
                    if(checkCollision(myBlob, targetBlob, threat) )  {
                        isSafe = false;
                    }
                }
                else {
                    if ( checkCollision(myBlob, targetBlob, threat) || lineDistance(threat, targetBlob) <= threat.size + 200) {
                        isSafe = false;
                    }
                }
            }
        });
        return isSafe;
    }

    // All blobs that aren't mine
    function getOtherBlobs(){
        return _.omit(getNodes(), getMyIDs());
    }

    // Gets any item which is a threat including bigger players and viruses
    function getThreats(blobArray, myMass) {
        // start by omitting all my IDs
        // then look for viruses smaller than us and blobs substantially bigger than us
        return _.filter(getOtherBlobs(), function(possibleThreat){
            var possibleThreatMass = getMass(possibleThreat.size);

            if(possibleThreat.d) {
                // Viruses are only a threat if we are bigger than them
                return myMass >= possibleThreatMass;
            }
            // other blobs are only a threat if they cross the 'Large' threshhold
            return possibleThreatMass > myMass * Large;
        });
    }

    function doGrazing(ws)
    {
        if(!isPlayerAlive()){
            isGrazing = false;
            setAcid(isGrazing);
            return;
        }

        grazingTargetID = null;

        var target;
        if(!getNodes().hasOwnProperty(grazingTargetID))
        {
            var target = findFoodToEat(getSelectedBlob(),getItems());
            if(-1 == target){
                isGrazing = false;
                setAcid(isGrazing);
                return;
            }
            grazingTargetID = target.id;
        }
        else
        {
            target = getNodes()[grazingTargetID];
        }
        sendMouseUpdate(ws, target.x + Math.random(), target.y + Math.random());
    }

    function findFoodToEat(cell, blobArray){
        var edibles = [];
        var densityResults = [];
        var threats = getThreats(blobArray, getMass(cell.size));
        blobArray.forEach(function (element){
            var distance = lineDistance(cell, element);
            element.isSafeTarget = null;
            if( getMass(element.size) <= (getMass(cell.size) * 0.4) && !element.d){
                if(isSafeTarget(cell, element, threats)){
                    edibles.push({"distance":distance, "id":element.id});
                    element.isSafeTarget = true;
                }
                else {
                    element.isSafeTarget = false;
                }
            }
        });
        edibles = edibles.sort(function(x,y){return x.distance<y.distance?-1:1;});
        edibles.forEach(function (element){
            var density = calcFoodDensity(getNodes()[element.id], blobArray)/(element.distance*2);
            densityResults.push({"density":density, "id":element.id});
        });
        if(0 === densityResults.length){
            console.log("No target found");
            //return avoidThreats(threats, k[0]);
            return -1;
        }
        var target = densityResults.sort(function(x,y){return x.density>y.density?-1:1;});
        //console.log("Choosing blob (" + target[0].id + ") with density of : "+ target[0].density);
        return getNodes()[target[0].id];
    }

    function calcFoodDensity(cell2, blobArray2){
        var MaxDistance2 = 250;
        var pelletCount = 0;
        blobArray2.forEach(function (element2){
            var distance2 = lineDistance(cell2, element2);
            var cond1 = getMass(element2.size) <= (getMass(getSelectedBlob().size) * 0.4);
            var cond2 = distance2 < MaxDistance2;
            var cond3 = !element2.d;
            //console.log(cond1 + " " + cond2 + " " + cond3);
            if( cond1 && cond2 && cond3 && cell2.isSafeTarget ){
                pelletCount +=1;
            }
        });
        return pelletCount;
    }
    function customKeyDownEvents(d)
    {
        if(jQuery("#overlays").is(':visible')){
            return;
        }

         if('G'.charCodeAt(0) === d.keyCode && isPlayerAlive()) {
            grazingTargetID = null;
            isGrazing = !isGrazing;
             setAcid(isGrazing);
        }
    }

    function Wa() {
        pa = true;
        Ca();
        setInterval(Ca, 18E4);
        C = qa = document.getElementById("canvas");
        f = C.getContext("2d");
        C.onmousedown = function (a) {
            if(Da) {
                var b = a.clientX - (5 + q / 5 / 2);
                var c = a.clientY - (5 + q / 5 / 2);
                if(Math.sqrt(b * b + c * c) <= q / 5 / 2) {
                    N();
                    D(17);
                    return;
                }
            }
            V = a.clientX;
            W = a.clientY;
            ra();
            N();
        };
        C.onmousemove = function (a) {
            V = a.clientX;
            W = a.clientY;
            ra();
        };
        C.onmouseup = function () {};
        if(/firefox/i.test(navigator.userAgent)) {
            document.addEventListener("DOMMouseScroll", Ea, false);
        } else {
            document.body.onmousewheel = Ea;
        }
        var a = false;
        var b = false;
        var c = false;
        g.onkeydown = function (d) {
            if(!(32 != d.keyCode)) {
                if(!a) {
                    N();
                    D(17);
                    a = true;
                }
            }
            if(!(81 != d.keyCode)) {
                if(!b) {
                    D(18);
                    b = true;
                }
            }
            if(!(87 != d.keyCode)) {
                if(!c) {
                    N();
                    D(21);
                    c = true;
                }
            }
            if(27 == d.keyCode) {
                Fa(true);
            }
            /*new*/customKeyDownEvents(d)
        };
        g.onkeyup = function (d) {
            if(32 == d.keyCode) {
                a = false;
            }
            if(87 == d.keyCode) {
                c = false;
            }
            if(81 == d.keyCode) {
                if(b) {
                    D(19);
                    b = false;
                }
            }
        };
        g.onblur = function () {
            D(19);
            c = b = a = false;
        };
        g.onresize = Ga;
        if(g.requestAnimationFrame) {
            g.requestAnimationFrame(Ha);
        } else {
            setInterval(sa, 1E3 / 60);
        }
        setInterval(N, 40);
        if(w) {
            m("#region")
                .val(w);
        }
        Ia();
        X(m("#region")
            .val());
        if(null == s$$0) {
            if(w) {
                Y();
            }
        }
        m("#overlays")
            .show();
        Ga();
    }

    function Ea(a) {
        E *= Math.pow(0.9, a.wheelDelta / -120 || (a.detail || 0));
        if(1 > E) {
            E = 1;
        }
        if(E > 4 / k) {
            E = 4 / k;
        }
    }

    function Xa() {
        if(0.4 > k) {
            O = null;
        } else {
            var a = Number.POSITIVE_INFINITY;
            var b = Number.POSITIVE_INFINITY;
            var c = Number.NEGATIVE_INFINITY;
            var d = Number.NEGATIVE_INFINITY;
            var e = 0;
            var l = 0;
            for(; l < v.length; l++) {
                var h = v[l];
                if(!!h.I()) {
                    if(!h.M) {
                        if(!(20 >= h.size * k)) {
                            e = Math.max(h.size, e);
                            a = Math.min(h.x, a);
                            b = Math.min(h.y, b);
                            c = Math.max(h.x, c);
                            d = Math.max(h.y, d);
                        }
                    }
                }
            }
            O = Ya.ca({
                X: a - (e + 100),
                Y: b - (e + 100),
                fa: c + (e + 100),
                ga: d + (e + 100),
                da: 2,
                ea: 4
            });
            l = 0;
            for(; l < v.length; l++) {
                if(h = v[l], h.I() && !(20 >= h.size * k)) {
                    a = 0;
                    for(; a < h.a.length; ++a) {
                        b = h.a[a].x;
                        c = h.a[a].y;
                        if(!(b < t - q / 2 / k)) {
                            if(!(c < u - r / 2 / k)) {
                                if(!(b > t + q / 2 / k)) {
                                    if(!(c > u + r / 2 / k)) {
                                        O.i(h.a[a]);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    function ra() {
        Z = (V - q / 2) / k + t;
        $ = (W - r / 2) / k + u;
    }

    function Ca() {
        if(null == aa) {
            aa = {};
            m("#region")
                .children()
                .each(function () {
                    var a = m(this);
                    var b = a.val();
                    if(b) {
                        aa[b] = a.text();
                    }
                });
        }
        m.get(ba + "//m.agar.io/info", function (a) {
            var b = {};
            var c;
            for(c in a.regions) {
                var d = c.split(":")[0];
                b[d] = b[d] || 0;
                b[d] += a.regions[c].numPlayers;
            }
            for(c in b) {
                m('#region option[value="' + c + '"]')
                    .text(aa[c] + " (" + b[c] + " players)");
            }
        }, "json");
    }

    function Ja() {
        m("#adsBottom")
            .hide();
        m("#overlays")
            .hide();
        Ia();
    }

    function X(a) {
        if(a) {
            if(a != w) {
                if(m("#region")
                    .val() != a) {
                    m("#region")
                        .val(a);
                }
                w = g.localStorage.location = a;
                m(".region-message")
                    .hide();
                m(".region-message." + a)
                    .show();
                m(".btn-needs-server")
                    .prop("disabled", false);
                if(pa) {
                    Y();
                }
            }
        }
    }

    function Fa(a) {
        F = null;
        Za();
        m("#overlays")
            .fadeIn(a ? 200 : 3E3);
        if(!a) {
            m("#adsBottom")
                .fadeIn(3E3);
        }
    }

    function Ia() {
        if(m("#region")
            .val()) {
            g.localStorage.location = m("#region")
                .val();
        } else {
            if(g.localStorage.location) {
                m("#region")
                    .val(g.localStorage.location);
            }
        }
        if(m("#region")
            .val()) {
            m("#locationKnown")
                .append(m("#region"));
        } else {
            m("#locationUnknown")
                .append(m("#region"));
        }
    }

    function Za() {
        if(!!ca) {
            if(!(75 <= P)) {
                ca = false;
                setTimeout(function () {
                    ca = true;
                }, 6E4 * da);
                g.googletag.pubads()
                    .refresh([g.mainAd]);
            }
        }
    }

    function Ka() {
        console.log("Find " + w + Q);
        m.ajax(ba + "//m.agar.io/", {
            error: function () {
                setTimeout(Ka, 1E3);
            },
            success: function (a) {
                a = a.split("\n");
                if(a[2]) {
                    alert(a[2]);
                }
                La("ws://" + a[0], a[1]);
            },
            dataType: "text",
            method: "POST",
            cache: false,
            crossDomain: true,
            data: (w + Q || "?") + "\n154669603"
        });
    }

    function Y() {
        if(pa) {
            if(w) {
                m("#connecting")
                    .show();
                Ka();
            }
        }
    }

    function La(a$$0, b) {
        if(s$$0) {
            s$$0.onopen = null;
            s$$0.onmessage = null;
            s$$0.onclose = null;
            try {
                s$$0.close();
            } catch(c$$0) {}
            s$$0 = null;
        }
        if($a) {
            var d = a$$0.split(":");
            a$$0 = d[0] + "s://ip-" + d[1].replace(/\./g, "-")
                .replace(/\//g, "") + ".tech.agar.io:" + (+d[2] + 2E3);
        }
        G = [];
        p = [];
        A = {};
        v = [];
        I = [];
        B = [];
        x = y = null;
        J = 0;
        ta = false;
        console.log("Connecting to " + a$$0);
        s$$0 = new WebSocket(a$$0);
        s$$0.binaryType = "arraybuffer";
        s$$0.onopen = function () {
            var a;
            console.log("socket open");
            a = K(5);
            a.setUint8(0, 254);
            a.setUint32(1, 4, true);
            L(a);
            a = K(5);
            a.setUint8(0, 255);
            a.setUint32(1, 154669603, true);
            L(a);
            a = K(1 + b.length);
            a.setUint8(0, 80);
            var c = 0;
            for(; c < b.length; ++c) {
                a.setUint8(c + 1, b.charCodeAt(c));
            }
            L(a);
            Ma();
        };
        s$$0.onmessage = ab;
        s$$0.onclose = bb;
        s$$0.onerror = function () {
            console.log("socket error");
        };
    }

    function K(a) {
        return new DataView(new ArrayBuffer(a));
    }

    function L(a) {
        s$$0.send(a.buffer);
    }

    function bb() {
        if(ta) {
            ea = 500;
        }
        console.log("socket close");
        setTimeout(Y, ea);
        ea *= 2;
    }

    function ab(a) {
        cb(new DataView(a.data));
    }

    function cb(a) {
        function b$$0() {
            var b = "";
            for(;;) {
                var d = a.getUint16(c, true);
                c += 2;
                if(0 == d) {
                    break;
                }
                b += String.fromCharCode(d);
            }
            return b;
        }
        var c = 0;
        if(240 == a.getUint8(c)) {
            c += 5;
        }
        switch(a.getUint8(c++)) {
        case 16:
            db(a, c);
            break;
        case 17:
            R = a.getFloat32(c, true);
            c += 4;
            S = a.getFloat32(c, true);
            c += 4;
            T = a.getFloat32(c, true);
            c += 4;
            break;
        case 20:
            p = [];
            G = [];
            break;
        case 21:
            ua = a.getInt16(c, true);
            c += 2;
            va = a.getInt16(c, true);
            c += 2;
            if(!wa) {
                wa = true;
                fa = ua;
                ga = va;
            }
            break;
        case 32:
            G.push(a.getUint32(c, true));
            c += 4;
            break;
        case 49:
            if(null != y) {
                break;
            }
            var d$$0 = a.getUint32(c, true);
            c = c + 4;
            B = [];
            var e = 0;
            for(; e < d$$0; ++e) {
                var l = a.getUint32(c, true);
                c = c + 4;
                B.push({
                    id: l,
                    name: b$$0()
                });
            }
            Na();
            break;
        case 50:
            y = [];
            d$$0 = a.getUint32(c, true);
            c += 4;
            e = 0;
            for(; e < d$$0; ++e) {
                y.push(a.getFloat32(c, true));
                c += 4;
            }
            Na();
            break;
        case 64:
            ha = a.getFloat64(c, true);
            c += 8;
            ia = a.getFloat64(c, true);
            c += 8;
            ja = a.getFloat64(c, true);
            c += 8;
            ka = a.getFloat64(c, true);
            c += 8;
            R = (ja + ha) / 2;
            S = (ka + ia) / 2;
            T = 1;
            if(0 == p.length) {
                t = R;
                u = S;
                k = T;
            };
        }
    }

    function db(a, b) {
        H = +new Date;
        ta = true;
        m("#connecting")
            .hide();
        var c = Math.random();
        xa = false;
        var d = a.getUint16(b, true);
        b += 2;
        var e = 0;
        for(; e < d; ++e) {
            var l = A[a.getUint32(b, true)];
            var h = A[a.getUint32(b + 4, true)];
            b += 8;
            if(l) {
                if(h) {
                    h.S();
                    h.p = h.x;
                    h.q = h.y;
                    h.o = h.size;
                    h.D = l.x;
                    h.F = l.y;
                    h.n = h.size;
                    h.L = H;
                }
            }
        }
        e = 0;
        for(;;) {
            d = a.getUint32(b, true);
            b += 4;
            if(0 == d) {
                break;
            }
            ++e;
            var f;
            l = a.getInt16(b, true);
            b += 2;
            h = a.getInt16(b, true);
            b += 2;
            f = a.getInt16(b, true);
            b += 2;
            var g = a.getUint8(b++);
            var k = a.getUint8(b++);
            var q = a.getUint8(b++);
            g = (g << 16 | k << 8 | q)
                .toString(16);
            for(; 6 > g.length;) {
                g = "0" + g;
            }
            g = "#" + g;
            k = a.getUint8(b++);
            q = !!(k & 1);
            var s = !!(k & 16);
            if(k & 2) {
                b += 4;
            }
            if(k & 4) {
                b += 8;
            }
            if(k & 8) {
                b += 16;
            }
            var r;
            var n = "";
            for(;;) {
                r = a.getUint16(b, true);
                b += 2;
                if(0 == r) {
                    break;
                }
                n += String.fromCharCode(r);
            }
            r = n;
            n = null;
            if(A.hasOwnProperty(d)) {
                n = A[d];
                n.K();
                n.p = n.x;
                n.q = n.y;
                n.o = n.size;
                n.color = g;
            } else {
                n = new Oa(d, l, h, f, g, r);
                v.push(n);
                A[d] = n;
                n.ka = l;
                n.la = h;
            }
            n.d = q;
            n.j = s;
            n.D = l;
            n.F = h;
            n.n = f;
            n.ja = c;
            n.L = H;
            n.W = k;
            if(r) {
                n.Z(r);
            }
            if(-1 != G.indexOf(d)) {
                if(-1 == p.indexOf(n)) {
                    document.getElementById("overlays")
                        .style.display = "none";
                    p.push(n);
                    if(1 == p.length) {
                        t = n.x;
                        u = n.y;
                    }
                }
            }
        }
        c = a.getUint32(b, true);
        b += 4;
        e = 0;
        for(; e < c; e++) {
            d = a.getUint32(b, true);
            b += 4;
            n = A[d];
            if(null != n) {
                n.S();
            }
        }
        if(xa) {
            if(0 == p.length) {
                Fa(false);
            }
        }
    }

    function N() {
        /*new*/if(isGrazing){ doGrazing(getWebSocket()); return; }
        var a;
        if(ya()) {
            a = V - q / 2;
            var b = W - r / 2;
            if(!(64 > a * a + b * b)) {
                if(!(0.01 > Math.abs(Pa - Z) && 0.01 > Math.abs(Qa - $))) {
                    Pa = Z;
                    Qa = $;
                    a = K(21);
                    a.setUint8(0, 16);
                    a.setFloat64(1, Z, true);
                    a.setFloat64(9, $, true);
                    a.setUint32(17, 0, true);
                    L(a);
                }
            }
        }
    }

    function Ma() {
        if(ya() && null != F) {
            var a = K(1 + 2 * F.length);
            a.setUint8(0, 0);
            var b = 0;
            for(; b < F.length; ++b) {
                a.setUint16(1 + 2 * b, F.charCodeAt(b), true);
            }
            L(a);
        }
    }

    function ya() {
        return null != s$$0 && s$$0.readyState == s$$0.OPEN;
    }

    function D(a) {
        if(ya()) {
            var b = K(1);
            b.setUint8(0, a);
            L(b);
        }
    }

    function Ha() {
        sa();
        g.requestAnimationFrame(Ha);
    }

    function Ga() {
        q = g.innerWidth;
        r = g.innerHeight;
        qa.width = C.width = q;
        qa.height = C.height = r;
        var a = m("#helloDialog");
        a.css("transform", "none");
        var b = a.height();
        var c = g.innerHeight;
        if(b > c / 1.1) {
            a.css("transform", "translate(-50%, -50%) scale(" + c / b / 1.1 + ")");
        } else {
            a.css("transform", "translate(-50%, -50%)");
        }
        sa();
    }

    function Ra() {
        var a;
        a = 1 * Math.max(r / 1080, q / 1920);
        return a *= E;
    }

    function eb() {
        if(0 != p.length) {
            var a = 0;
            var b = 0;
            for(; b < p.length; b++) {
                a += p[b].size;
            }
            a = Math.pow(Math.min(64 / a, 1), 0.4) * Ra();
            k = (9 * k + a) / 10;
        }
    }

    function sa() {
        var a$$0;
        var b$$0 = Date.now();
        ++fb;
        H = b$$0;
        if(0 < p.length) {
            eb();
            var c = a$$0 = 0;
            var d = 0;
            for(; d < p.length; d++) {
                p[d].K();
                a$$0 += p[d].x / p.length;
                c += p[d].y / p.length;
            }
            R = a$$0;
            S = c;
            T = k;
            t = (t + a$$0) / 2;
            u = (u + c) / 2;
        } else {
            t = (29 * t + R) / 30;
            u = (29 * u + S) / 30;
            k = (9 * k + T * Ra()) / 10;
        }
        Xa();
        ra();
        if(!za) {
            f.clearRect(0, 0, q, r);
        }
        if(za) {
            f.fillStyle = la ? "#111111" : "#F2FBFF";
            f.globalAlpha = 0.05;
            f.fillRect(0, 0, q, r);
            f.globalAlpha = 1;
        } else {
            gb();
        }
        v.sort(function (a, b) {
            return a.size == b.size ? a.id - b.id : a.size - b.size;
        });
        f.save();
        f.translate(q / 2, r / 2);
        f.scale(k, k);
        f.translate(-t, -u);
        d = 0;
        for(; d < I.length; d++) {
            I[d].T(f);
        }
        d = 0;
        for(; d < v.length; d++) {
            v[d].T(f);
        }
        if(wa) {
            fa = (3 * fa + ua) / 4;
            ga = (3 * ga + va) / 4;
            f.save();
            f.strokeStyle = "#FFAAAA";
            f.lineWidth = 10;
            f.lineCap = "round";
            f.lineJoin = "round";
            f.globalAlpha = 0.5;
            f.beginPath();
            d = 0;
            for(; d < p.length; d++) {
                f.moveTo(p[d].x, p[d].y);
                f.lineTo(fa, ga);
            }
            f.stroke();
            f.restore();
        }
        f.restore();
        if(x) {
            if(x.width) {
                f.drawImage(x, q - x.width - 10, 10);
            }
        }
        J = Math.max(J, hb());
        if(0 != J) {
            if(null == ma) {
                ma = new na(24, "#FFFFFF");
            }
            ma.u("Score: " + ~~(J / 100));
            c = ma.G();
            a$$0 = c.width;
            f.globalAlpha = 0.2;
            f.fillStyle = "#000000";
            f.fillRect(10, r - 10 - 24 - 10, a$$0 + 10, 34);
            f.globalAlpha = 1;
            f.drawImage(c, 15, r - 10 - 24 - 5);
        }
        ib();
        b$$0 = Date.now() - b$$0;
        if(b$$0 > 1E3 / 60) {
            z -= 0.01;
        } else {
            if(b$$0 < 1E3 / 65) {
                z += 0.01;
            }
        }
        if(0.4 > z) {
            z = 0.4;
        }
        if(1 < z) {
            z = 1;
        }
    }

    function gb() {
        f.fillStyle = la ? "#111111" : "#F2FBFF";
        f.fillRect(0, 0, q, r);
        f.save();
        f.strokeStyle = la ? "#AAAAAA" : "#000000";
        f.globalAlpha = 0.2;
        f.scale(k, k);
        var a = q / k;
        var b = r / k;
        var c = -0.5 + (-t + a / 2) % 50;
        for(; c < a; c += 50) {
            f.beginPath();
            f.moveTo(c, 0);
            f.lineTo(c, b);
            f.stroke();
        }
        c = -0.5 + (-u + b / 2) % 50;
        for(; c < b; c += 50) {
            f.beginPath();
            f.moveTo(0, c);
            f.lineTo(a, c);
            f.stroke();
        }
        f.restore();
    }

    function ib() {
        if(Da && Aa.width) {
            var a = q / 5;
            f.drawImage(Aa, 5, 5, a, a);
        }
    }

    function hb() {
        var a = 0;
        var b = 0;
        for(; b < p.length; b++) {
            a += p[b].n * p[b].n;
        }
        return a;
    }

    function Na() {
        x = null;
        if(null != y || 0 != B.length) {
            if(null != y || oa) {
                x = document.createElement("canvas");
                var a = x.getContext("2d");
                var b = 60;
                b = null == y ? b + 24 * B.length : b + 180;
                var c = Math.min(200, 0.3 * q) / 200;
                x.width = 200 * c;
                x.height = b * c;
                a.scale(c, c);
                a.globalAlpha = 0.4;
                a.fillStyle = "#000000";
                a.fillRect(0, 0, 200, b);
                a.globalAlpha = 1;
                a.fillStyle = "#FFFFFF";
                c = null;
                c = "Leaderboard";
                a.font = "30px Ubuntu";
                a.fillText(c, 100 - a.measureText(c)
                    .width / 2, 40);
                if(null == y) {
                    a.font = "20px Ubuntu";
                    b = 0;
                    for(; b < B.length; ++b) {
                        c = B[b].name || "An unnamed cell";
                        if(!oa) {
                            c = "An unnamed cell";
                        }
                        if(-1 != G.indexOf(B[b].id)) {
                            if(p[0].name) {
                                c = p[0].name;
                            }
                            a.fillStyle = "#FFAAAA";
                        } else {
                            a.fillStyle = "#FFFFFF";
                        }
                        c = b + 1 + ". " + c;
                        a.fillText(c, 100 - a.measureText(c)
                            .width / 2, 70 + 24 * b);
                    }
                } else {
                    b = c = 0;
                    for(; b < y.length; ++b) {
                        var d = c + y[b] * Math.PI * 2;
                        a.fillStyle = jb[b + 1];
                        a.beginPath();
                        a.moveTo(100, 140);
                        a.arc(100, 140, 80, c, d, false);
                        a.fill();
                        c = d;
                    }
                }
            }
        }
    }

    function Oa(a, b, c, d, e, l) {
        this.id = a;
        this.p = this.x = b;
        this.q = this.y = c;
        this.o = this.size = d;
        this.color = e;
        this.a = [];
        this.l = [];
        this.R();
        this.Z(l);
    }

    function na(a, b, c, d) {
        if(a) {
            this.r = a;
        }
        if(b) {
            this.N = b;
        }
        this.P = !!c;
        if(d) {
            this.s = d;
        }
    }
    var ba = g.location.protocol;
    var $a = "https:" == ba;
    if(g.location.ancestorOrigins && (g.location.ancestorOrigins.length && "https://apps.facebook.com" != g.location.ancestorOrigins[0])) {
        g.top.location = "http://agar.io/";
    } else {
        var qa;
        var f;
        var C;
        var q;
        var r;
        var O = null;
        var s$$0 = null;
        var t = 0;
        var u = 0;
        var G = [];
        var p = [];
        var A = {};
        var v = [];
        var I = [];
        var B = [];
        var V = 0;
        var W = 0;
        var Z = -1;
        var $ = -1;
        var fb = 0;
        var H = 0;
        var F = null;
        var ha = 0;
        var ia = 0;
        var ja = 1E4;
        var ka = 1E4;
        var k = 1;
        var w = null;
        var Sa = true;
        var oa = true;
        var Ba = false;
        var xa = false;
        var J = 0;
        var la = false;
        var Ta = false;
        var R = t = ~~((ha + ja) / 2);
        var S = u = ~~((ia + ka) / 2);
        var T = 1;
        var Q = "";
        var y = null;
        var pa = false;
        var wa = false;
        var ua = 0;
        var va = 0;
        var fa = 0;
        var ga = 0;
        var P = 0;
        var jb = ["#333333", "#FF3333", "#33FF33", "#3333FF"];
        var za = false;
        var ta = false;
        var E = 1;
        var Da = "ontouchstart" in g && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        var Aa = new Image;
        Aa.src = "img/split.png";
        var Ua = document.createElement("canvas");
        if("undefined" == typeof console || ("undefined" == typeof DataView || ("undefined" == typeof WebSocket || (null == Ua || (null == Ua.getContext || null == g.localStorage))))) {
            alert("You browser does not support this game, we recommend you to use Firefox to play this");
        } else {
            var aa = null;
            g.setNick = function (a) {
                Ja();
                F = a;
                Ma();
                J = 0;
            };
            g.setRegion = X;
            g.setSkins = function (a) {
                Sa = a;
            };
            g.setNames = function (a) {
                oa = a;
            };
            g.setDarkTheme = function (a) {
                la = a;
            };
            g.setColors = function (a) {
                Ba = a;
            };
            g.setShowMass = function (a) {
                Ta = a;
            };
            g.spectate = function () {
                F = null;
                D(1);
                Ja();
            };
            g.setGameMode = function (a) {
                if(a != Q) {
                    Q = a;
                    Y();
                }
            };
            g.setAcid = function (a) {
                za = a;
            };
            if(null != g.localStorage) {
                if(null == g.localStorage.AB9) {
                    g.localStorage.AB9 = 0 + ~~(100 * Math.random());
                }
                P = +g.localStorage.AB9;
                g.ABGroup = P;
            }
            m.get(ba + "//gc.agar.io", function (a) {
                var b = a.split(" ");
                a = b[0];
                b = b[1] || "";
                if(-1 == ["UA"].indexOf(a)) {
                    Va.push("ussr");
                }
                if(U.hasOwnProperty(a)) {
                    if("string" == typeof U[a]) {
                        if(!w) {
                            X(U[a]);
                        }
                    } else {
                        if(U[a].hasOwnProperty(b)) {
                            if(!w) {
                                X(U[a][b]);
                            }
                        }
                    }
                }
            }, "text");
            var ca = false;
            var da = 0;
            if(25 > P) {
                da = 10;
            } else {
                if(50 > P) {
                    da = 5;
                }
            }
            setTimeout(function () {
                ca = true;
            }, Math.max(6E4 * da, 1E4));
            var U = {
                AF: "JP-Tokyo",
                AX: "EU-London",
                AL: "EU-London",
                DZ: "EU-London",
                AS: "SG-Singapore",
                AD: "EU-London",
                AO: "EU-London",
                AI: "US-Atlanta",
                AG: "US-Atlanta",
                AR: "BR-Brazil",
                AM: "JP-Tokyo",
                AW: "US-Atlanta",
                AU: "SG-Singapore",
                AT: "EU-London",
                AZ: "JP-Tokyo",
                BS: "US-Atlanta",
                BH: "JP-Tokyo",
                BD: "JP-Tokyo",
                BB: "US-Atlanta",
                BY: "EU-London",
                BE: "EU-London",
                BZ: "US-Atlanta",
                BJ: "EU-London",
                BM: "US-Atlanta",
                BT: "JP-Tokyo",
                BO: "BR-Brazil",
                BQ: "US-Atlanta",
                BA: "EU-London",
                BW: "EU-London",
                BR: "BR-Brazil",
                IO: "JP-Tokyo",
                VG: "US-Atlanta",
                BN: "JP-Tokyo",
                BG: "EU-London",
                BF: "EU-London",
                BI: "EU-London",
                KH: "JP-Tokyo",
                CM: "EU-London",
                CA: "US-Atlanta",
                CV: "EU-London",
                KY: "US-Atlanta",
                CF: "EU-London",
                TD: "EU-London",
                CL: "BR-Brazil",
                CN: "CN-China",
                CX: "JP-Tokyo",
                CC: "JP-Tokyo",
                CO: "BR-Brazil",
                KM: "EU-London",
                CD: "EU-London",
                CG: "EU-London",
                CK: "SG-Singapore",
                CR: "US-Atlanta",
                CI: "EU-London",
                HR: "EU-London",
                CU: "US-Atlanta",
                CW: "US-Atlanta",
                CY: "JP-Tokyo",
                CZ: "EU-London",
                DK: "EU-London",
                DJ: "EU-London",
                DM: "US-Atlanta",
                DO: "US-Atlanta",
                EC: "BR-Brazil",
                EG: "EU-London",
                SV: "US-Atlanta",
                GQ: "EU-London",
                ER: "EU-London",
                EE: "EU-London",
                ET: "EU-London",
                FO: "EU-London",
                FK: "BR-Brazil",
                FJ: "SG-Singapore",
                FI: "EU-London",
                FR: "EU-London",
                GF: "BR-Brazil",
                PF: "SG-Singapore",
                GA: "EU-London",
                GM: "EU-London",
                GE: "JP-Tokyo",
                DE: "EU-London",
                GH: "EU-London",
                GI: "EU-London",
                GR: "EU-London",
                GL: "US-Atlanta",
                GD: "US-Atlanta",
                GP: "US-Atlanta",
                GU: "SG-Singapore",
                GT: "US-Atlanta",
                GG: "EU-London",
                GN: "EU-London",
                GW: "EU-London",
                GY: "BR-Brazil",
                HT: "US-Atlanta",
                VA: "EU-London",
                HN: "US-Atlanta",
                HK: "JP-Tokyo",
                HU: "EU-London",
                IS: "EU-London",
                IN: "JP-Tokyo",
                ID: "JP-Tokyo",
                IR: "JP-Tokyo",
                IQ: "JP-Tokyo",
                IE: "EU-London",
                IM: "EU-London",
                IL: "JP-Tokyo",
                IT: "EU-London",
                JM: "US-Atlanta",
                JP: "JP-Tokyo",
                JE: "EU-London",
                JO: "JP-Tokyo",
                KZ: "JP-Tokyo",
                KE: "EU-London",
                KI: "SG-Singapore",
                KP: "JP-Tokyo",
                KR: "JP-Tokyo",
                KW: "JP-Tokyo",
                KG: "JP-Tokyo",
                LA: "JP-Tokyo",
                LV: "EU-London",
                LB: "JP-Tokyo",
                LS: "EU-London",
                LR: "EU-London",
                LY: "EU-London",
                LI: "EU-London",
                LT: "EU-London",
                LU: "EU-London",
                MO: "JP-Tokyo",
                MK: "EU-London",
                MG: "EU-London",
                MW: "EU-London",
                MY: "JP-Tokyo",
                MV: "JP-Tokyo",
                ML: "EU-London",
                MT: "EU-London",
                MH: "SG-Singapore",
                MQ: "US-Atlanta",
                MR: "EU-London",
                MU: "EU-London",
                YT: "EU-London",
                MX: "US-Atlanta",
                FM: "SG-Singapore",
                MD: "EU-London",
                MC: "EU-London",
                MN: "JP-Tokyo",
                ME: "EU-London",
                MS: "US-Atlanta",
                MA: "EU-London",
                MZ: "EU-London",
                MM: "JP-Tokyo",
                NA: "EU-London",
                NR: "SG-Singapore",
                NP: "JP-Tokyo",
                NL: "EU-London",
                NC: "SG-Singapore",
                NZ: "SG-Singapore",
                NI: "US-Atlanta",
                NE: "EU-London",
                NG: "EU-London",
                NU: "SG-Singapore",
                NF: "SG-Singapore",
                MP: "SG-Singapore",
                NO: "EU-London",
                OM: "JP-Tokyo",
                PK: "JP-Tokyo",
                PW: "SG-Singapore",
                PS: "JP-Tokyo",
                PA: "US-Atlanta",
                PG: "SG-Singapore",
                PY: "BR-Brazil",
                PE: "BR-Brazil",
                PH: "JP-Tokyo",
                PN: "SG-Singapore",
                PL: "EU-London",
                PT: "EU-London",
                PR: "US-Atlanta",
                QA: "JP-Tokyo",
                RE: "EU-London",
                RO: "EU-London",
                RU: "RU-Russia",
                RW: "EU-London",
                BL: "US-Atlanta",
                SH: "EU-London",
                KN: "US-Atlanta",
                LC: "US-Atlanta",
                MF: "US-Atlanta",
                PM: "US-Atlanta",
                VC: "US-Atlanta",
                WS: "SG-Singapore",
                SM: "EU-London",
                ST: "EU-London",
                SA: "EU-London",
                SN: "EU-London",
                RS: "EU-London",
                SC: "EU-London",
                SL: "EU-London",
                SG: "JP-Tokyo",
                SX: "US-Atlanta",
                SK: "EU-London",
                SI: "EU-London",
                SB: "SG-Singapore",
                SO: "EU-London",
                ZA: "EU-London",
                SS: "EU-London",
                ES: "EU-London",
                LK: "JP-Tokyo",
                SD: "EU-London",
                SR: "BR-Brazil",
                SJ: "EU-London",
                SZ: "EU-London",
                SE: "EU-London",
                CH: "EU-London",
                SY: "EU-London",
                TW: "JP-Tokyo",
                TJ: "JP-Tokyo",
                TZ: "EU-London",
                TH: "JP-Tokyo",
                TL: "JP-Tokyo",
                TG: "EU-London",
                TK: "SG-Singapore",
                TO: "SG-Singapore",
                TT: "US-Atlanta",
                TN: "EU-London",
                TR: "TK-Turkey",
                TM: "JP-Tokyo",
                TC: "US-Atlanta",
                TV: "SG-Singapore",
                UG: "EU-London",
                UA: "EU-London",
                AE: "EU-London",
                GB: "EU-London",
                US: {
                    AL: "US-Atlanta",
                    AK: "US-Fremont",
                    AZ: "US-Fremont",
                    AR: "US-Atlanta",
                    CA: "US-Fremont",
                    CO: "US-Fremont",
                    CT: "US-Atlanta",
                    DE: "US-Atlanta",
                    FL: "US-Atlanta",
                    GA: "US-Atlanta",
                    HI: "US-Fremont",
                    ID: "US-Fremont",
                    IL: "US-Atlanta",
                    IN: "US-Atlanta",
                    IA: "US-Atlanta",
                    KS: "US-Atlanta",
                    KY: "US-Atlanta",
                    LA: "US-Atlanta",
                    ME: "US-Atlanta",
                    MD: "US-Atlanta",
                    MA: "US-Atlanta",
                    MI: "US-Atlanta",
                    MN: "US-Fremont",
                    MS: "US-Atlanta",
                    MO: "US-Atlanta",
                    MT: "US-Fremont",
                    NE: "US-Fremont",
                    NV: "US-Fremont",
                    NH: "US-Atlanta",
                    NJ: "US-Atlanta",
                    NM: "US-Fremont",
                    NY: "US-Atlanta",
                    NC: "US-Atlanta",
                    ND: "US-Fremont",
                    OH: "US-Atlanta",
                    OK: "US-Atlanta",
                    OR: "US-Fremont",
                    PA: "US-Atlanta",
                    RI: "US-Atlanta",
                    SC: "US-Atlanta",
                    SD: "US-Fremont",
                    TN: "US-Atlanta",
                    TX: "US-Atlanta",
                    UT: "US-Fremont",
                    VT: "US-Atlanta",
                    VA: "US-Atlanta",
                    WA: "US-Fremont",
                    WV: "US-Atlanta",
                    WI: "US-Atlanta",
                    WY: "US-Fremont",
                    DC: "US-Atlanta",
                    AS: "US-Atlanta",
                    GU: "US-Atlanta",
                    MP: "US-Atlanta",
                    PR: "US-Atlanta",
                    UM: "US-Atlanta",
                    VI: "US-Atlanta"
                },
                UM: "SG-Singapore",
                VI: "US-Atlanta",
                UY: "BR-Brazil",
                UZ: "JP-Tokyo",
                VU: "SG-Singapore",
                VE: "BR-Brazil",
                VN: "JP-Tokyo",
                WF: "SG-Singapore",
                EH: "EU-London",
                YE: "JP-Tokyo",
                ZM: "EU-London",
                ZW: "EU-London"
            };
            g.connect = La;
            var ea = 500;
            var Pa = -1;
            var Qa = -1;
            var x = null;
            var z = 1;
            var ma = null;
            var M = {};
            var Va = "poland;usa;china;russia;canada;australia;spain;brazil;germany;ukraine;france;sweden;chaplin;north korea;south korea;japan;united kingdom;earth;greece;latvia;lithuania;estonia;finland;norway;cia;maldivas;austria;nigeria;reddit;yaranaika;confederate;9gag;indiana;4chan;italy;bulgaria;tumblr;2ch.hk;hong kong;portugal;jamaica;german empire;mexico;sanik;switzerland;croatia;chile;indonesia;bangladesh;thailand;iran;iraq;peru;moon;botswana;bosnia;netherlands;european union;taiwan;pakistan;hungary;satanist;qing dynasty;matriarchy;patriarchy;feminism;ireland;texas;facepunch;prodota;cambodia;steam;piccolo;ea;india;kc;denmark;quebec;ayy lmao;sealand;bait;tsarist russia;origin;vinesauce;stalin;belgium;luxembourg;stussy;prussia;8ch;argentina;scotland;sir;romania;belarus;wojak;doge;nasa;byzantium;imperial japan;french kingdom;somalia;turkey;mars;pokerface;8;irs;receita federal;facebook".split(";");
            var kb = ["8", "nasa"];
            var lb = ["m'blob"];
            Oa.prototype = {
                id: 0,
                a: null,
                l: null,
                name: null,
                k: null,
                J: null,
                x: 0,
                y: 0,
                size: 0,
                p: 0,
                q: 0,
                o: 0,
                D: 0,
                F: 0,
                n: 0,
                W: 0,
                L: 0,
                ja: 0,
                ba: 0,
                A: false,
                d: false,
                j: false,
                M: true,
                S: function () {
                    var a;
                    a = 0;
                    for(; a < v.length; a++) {
                        if(v[a] == this) {
                            v.splice(a, 1);
                            break;
                        }
                    }
                    delete A[this.id];
                    a = p.indexOf(this);
                    if(-1 != a) {
                        xa = true;
                        p.splice(a, 1);
                    }
                    a = G.indexOf(this.id);
                    if(-1 != a) {
                        G.splice(a, 1);
                    }
                    this.A = true;
                    I.push(this);
                },
                h: function () {
                    return Math.max(~~(0.3 * this.size), 24);
                },
                Z: function (a) {
                    if(this.name = a) {
                        if(null == this.k) {
                            this.k = new na(this.h(), "#FFFFFF", true, "#000000");
                        } else {
                            this.k.H(this.h());
                        }
                        this.k.u(this.name);
                    }
                },
                R: function () {
                    var a = this.C();
                    for(; this.a.length > a;) {
                        var b = ~~(Math.random() * this.a.length);
                        this.a.splice(b, 1);
                        this.l.splice(b, 1);
                    }
                    if(0 == this.a.length) {
                        if(0 < a) {
                            this.a.push({
                                Q: this,
                                e: this.size,
                                x: this.x,
                                y: this.y
                            });
                            this.l.push(Math.random() - 0.5);
                        }
                    }
                    for(; this.a.length < a;) {
                        b = ~~(Math.random() * this.a.length);
                        var c = this.a[b];
                        this.a.splice(b, 0, {
                            Q: this,
                            e: c.e,
                            x: c.x,
                            y: c.y
                        });
                        this.l.splice(b, 0, this.l[b]);
                    }
                },
                C: function () {
                    if(0 == this.id) {
                        return 16;
                    }
                    var a = 10;
                    if(20 > this.size) {
                        a = 0;
                    }
                    if(this.d) {
                        a = 30;
                    }
                    var b = this.size;
                    if(!this.d) {
                        b *= k;
                    }
                    b *= z;
                    if(this.W & 32) {
                        b *= 0.25;
                    }
                    return ~~Math.max(b, a);
                },
                ha: function () {
                    this.R();
                    var a$$0 = this.a;
                    var b = this.l;
                    var c = a$$0.length;
                    var d = 0;
                    for(; d < c; ++d) {
                        var e = b[(d - 1 + c) % c];
                        var l = b[(d + 1) % c];
                        b[d] += (Math.random() - 0.5) * (this.j ? 3 : 1);
                        b[d] *= 0.7;
                        if(10 < b[d]) {
                            b[d] = 10;
                        }
                        if(-10 > b[d]) {
                            b[d] = -10;
                        }
                        b[d] = (e + l + 8 * b[d]) / 10;
                    }
                    var h = this;
                    var g = this.d ? 0 : (this.id / 1E3 + H / 1E4) % (2 * Math.PI);
                    d = 0;
                    for(; d < c; ++d) {
                        var f = a$$0[d].e;
                        e = a$$0[(d - 1 + c) % c].e;
                        l = a$$0[(d + 1) % c].e;
                        if(15 < this.size && (null != O && (20 < this.size * k && 0 != this.id))) {
                            var m = false;
                            var p = a$$0[d].x;
                            var q = a$$0[d].y;
                            O.ia(p - 5, q - 5, 10, 10, function (a) {
                                if(a.Q != h) {
                                    if(25 > (p - a.x) * (p - a.x) + (q - a.y) * (q - a.y)) {
                                        m = true;
                                    }
                                }
                            });
                            if(!m) {
                                if(a$$0[d].x < ha || (a$$0[d].y < ia || (a$$0[d].x > ja || a$$0[d].y > ka))) {
                                    m = true;
                                }
                            }
                            if(m) {
                                if(0 < b[d]) {
                                    b[d] = 0;
                                }
                                b[d] -= 1;
                            }
                        }
                        f += b[d];
                        if(0 > f) {
                            f = 0;
                        }
                        f = this.j ? (19 * f + this.size) / 20 : (12 * f + this.size) / 13;
                        a$$0[d].e = (e + l + 8 * f) / 10;
                        e = 2 * Math.PI / c;
                        l = this.a[d].e;
                        if(this.d) {
                            if(0 == d % 2) {
                                l += 5;
                            }
                        }
                        a$$0[d].x = this.x + Math.cos(e * d + g) * l;
                        a$$0[d].y = this.y + Math.sin(e * d + g) * l;
                    }
                },
                K: function () {
                    if(0 == this.id) {
                        return 1;
                    }
                    var a;
                    a = (H - this.L) / 120;
                    a = 0 > a ? 0 : 1 < a ? 1 : a;
                    var b = 0 > a ? 0 : 1 < a ? 1 : a;
                    this.h();
                    if(this.A && 1 <= b) {
                        var c = I.indexOf(this);
                        if(-1 != c) {
                            I.splice(c, 1);
                        }
                    }
                    this.x = a * (this.D - this.p) + this.p;
                    this.y = a * (this.F - this.q) + this.q;
                    this.size = b * (this.n - this.o) + this.o;
                    return b;
                },
                I: function () {
                    return 0 == this.id ? true : this.x + this.size + 40 < t - q / 2 / k || (this.y + this.size + 40 < u - r / 2 / k || (this.x - this.size - 40 > t + q / 2 / k || this.y - this.size - 40 > u + r / 2 / k)) ? false : true;
                },
                T: function (a) {
                    if(this.I()) {
                        var b = 0 != this.id && (!this.d && (!this.j && 0.4 > k));
                        if(5 > this.C()) {
                            b = true;
                        }
                        if(this.M && !b) {
                            var c = 0;
                            for(; c < this.a.length; c++) {
                                this.a[c].e = this.size;
                            }
                        }
                        this.M = b;
                        a.save();
                        this.ba = H;
                        c = this.K();
                        if(this.A) {
                            a.globalAlpha *= 1 - c;
                        }
                        a.lineWidth = 10;
                        a.lineCap = "round";
                        a.lineJoin = this.d ? "miter" : "round";
                        if(Ba) {
                            a.fillStyle = "#FFFFFF";
                            a.strokeStyle = "#AAAAAA";
                        } else {
                            a.fillStyle = this.color;
                            a.strokeStyle = this.color;
                        }
                        if(b) {
                            a.beginPath();
                            a.arc(this.x, this.y, this.size + 5, 0, 2 * Math.PI, false);
                        } else {
                            this.ha();
                            a.beginPath();
                            var d = this.C();
                            a.moveTo(this.a[0].x, this.a[0].y);
                            c = 1;
                            for(; c <= d; ++c) {
                                var e = c % d;
                                a.lineTo(this.a[e].x, this.a[e].y);
                            }
                        }
                        a.closePath();
                        d = this.name.toLowerCase();
                        if(!this.j && (Sa && ":teams" != Q)) {
                            if(-1 != Va.indexOf(d)) {
                                if(!M.hasOwnProperty(d)) {
                                    M[d] = new Image;
                                    M[d].src = "skins/" + d + ".png";
                                }
                                c = 0 != M[d].width && M[d].complete ? M[d] : null;
                            } else {
                                c = null;
                            }
                        } else {
                            c = null;
                        }
                        c = (e = c) ? -1 != lb.indexOf(d) : false;
                        if(!b) {
                            a.stroke();
                        }
                        a.fill();
                        if(!(null == e)) {
                            if(!c) {
                                a.save();
                                a.clip();
                                a.drawImage(e, this.x - this.size, this.y - this.size, 2 * this.size, 2 * this.size);
                                a.restore();
                            }
                        }
                        if(Ba || 15 < this.size) {
                            if(!b) {
                                a.strokeStyle = "#000000";
                                a.globalAlpha *= 0.1;
                                a.stroke();
                            }
                        }
                        a.globalAlpha = 1;
                        if(null != e) {
                            if(c) {
                                a.drawImage(e, this.x - 2 * this.size, this.y - 2 * this.size, 4 * this.size, 4 * this.size);
                            }
                        }
                        c = -1 != p.indexOf(this);
                        if(0 != this.id) {
                            b = ~~this.y;
                            if((oa || c) && (this.name && (this.k && (null == e || -1 == kb.indexOf(d))))) {
                                e = this.k;
                                e.u(this.name);
                                e.H(this.h());
                                d = Math.ceil(10 * k) / 10;
                                e.$(d);
                                e = e.G();
                                var l = ~~(e.width / d);
                                var h = ~~(e.height / d);
                                a.drawImage(e, ~~this.x - ~~(l / 2), b - ~~(h / 2), l, h);
                                b += e.height / 2 / d + 4;
                            }
                            if(Ta) {
                                if(c || 0 == p.length && ((!this.d || this.j) && 20 < this.size)) {
                                    if(null == this.J) {
                                        this.J = new na(this.h() / 2, "#FFFFFF", true, "#000000");
                                    }
                                    c = this.J;
                                    c.H(this.h() / 2);
                                    c.u(~~(this.size * this.size / 100));
                                    d = Math.ceil(10 * k) / 10;
                                    c.$(d);
                                    e = c.G();
                                    l = ~~(e.width / d);
                                    h = ~~(e.height / d);
                                    a.drawImage(e, ~~this.x - ~~(l / 2), b - ~~(h / 2), l, h);
                                }
                            }
                        }
                        a.restore();
                    }
                }
            };
            na.prototype = {
                w: "",
                N: "#000000",
                P: false,
                s: "#000000",
                r: 16,
                m: null,
                O: null,
                g: false,
                v: 1,
                H: function (a) {
                    if(this.r != a) {
                        this.r = a;
                        this.g = true;
                    }
                },
                $: function (a) {
                    if(this.v != a) {
                        this.v = a;
                        this.g = true;
                    }
                },
                setStrokeColor: function (a) {
                    if(this.s != a) {
                        this.s = a;
                        this.g = true;
                    }
                },
                u: function (a) {
                    if(a != this.w) {
                        this.w = a;
                        this.g = true;
                    }
                },
                G: function () {
                    if(null == this.m) {
                        this.m = document.createElement("canvas");
                        this.O = this.m.getContext("2d");
                    }
                    if(this.g) {
                        this.g = false;
                        var a = this.m;
                        var b = this.O;
                        var c = this.w;
                        var d = this.v;
                        var e = this.r;
                        var l = e + "px Ubuntu";
                        b.font = l;
                        var h = ~~(0.2 * e);
                        a.width = (b.measureText(c)
                            .width + 6) * d;
                        a.height = (e + h) * d;
                        b.font = l;
                        b.scale(d, d);
                        b.globalAlpha = 1;
                        b.lineWidth = 3;
                        b.strokeStyle = this.s;
                        b.fillStyle = this.N;
                        if(this.P) {
                            b.strokeText(c, 3, e - h / 2);
                        }
                        b.fillText(c, 3, e - h / 2);
                    }
                    return this.m;
                }
            };
            if(!Date.now) {
                Date.now = function () {
                    return(new Date)
                        .getTime();
                };
            }
            var Ya = {
                ca: function (a$$0) {
                    function b$$1(a, b, c, d, e) {
                        this.x = a;
                        this.y = b;
                        this.f = c;
                        this.c = d;
                        this.depth = e;
                        this.items = [];
                        this.b = [];
                    }
                    var c$$1 = a$$0.da || 2;
                    var d$$0 = a$$0.ea || 4;
                    b$$1.prototype = {
                        x: 0,
                        y: 0,
                        f: 0,
                        c: 0,
                        depth: 0,
                        items: null,
                        b: null,
                        B: function (a) {
                            var b$$0 = 0;
                            for(; b$$0 < this.items.length; ++b$$0) {
                                var c = this.items[b$$0];
                                if(c.x >= a.x && (c.y >= a.y && (c.x < a.x + a.f && c.y < a.y + a.c))) {
                                    return true;
                                }
                            }
                            if(0 != this.b.length) {
                                var d = this;
                                return this.V(a, function (b) {
                                    return d.b[b].B(a);
                                });
                            }
                            return false;
                        },
                        t: function (a, b) {
                            var c$$0 = 0;
                            for(; c$$0 < this.items.length; ++c$$0) {
                                b(this.items[c$$0]);
                            }
                            if(0 != this.b.length) {
                                var d = this;
                                this.V(a, function (c) {
                                    d.b[c].t(a, b);
                                });
                            }
                        },
                        i: function (a) {
                            if(0 != this.b.length) {
                                this.b[this.U(a)].i(a);
                            } else {
                                if(this.items.length >= c$$1 && this.depth < d$$0) {
                                    this.aa();
                                    this.b[this.U(a)].i(a);
                                } else {
                                    this.items.push(a);
                                }
                            }
                        },
                        U: function (a) {
                            return a.x < this.x + this.f / 2 ? a.y < this.y + this.c / 2 ? 0 : 2 : a.y < this.y + this.c / 2 ? 1 : 3;
                        },
                        V: function (a, b) {
                            return a.x < this.x + this.f / 2 && (a.y < this.y + this.c / 2 && b(0) || a.y >= this.y + this.c / 2 && b(2)) || a.x >= this.x + this.f / 2 && (a.y < this.y + this.c / 2 && b(1) || a.y >= this.y + this.c / 2 && b(3)) ? true : false;
                        },
                        aa: function () {
                            var a = this.depth + 1;
                            var c = this.f / 2;
                            var d = this.c / 2;
                            this.b.push(new b$$1(this.x, this.y, c, d, a));
                            this.b.push(new b$$1(this.x + c, this.y, c, d, a));
                            this.b.push(new b$$1(this.x, this.y + d, c, d, a));
                            this.b.push(new b$$1(this.x + c, this.y + d, c, d, a));
                            a = this.items;
                            this.items = [];
                            c = 0;
                            for(; c < a.length; c++) {
                                this.i(a[c]);
                            }
                        },
                        clear: function () {
                            var a = 0;
                            for(; a < this.b.length; a++) {
                                this.b[a].clear();
                            }
                            this.items.length = 0;
                            this.b.length = 0;
                        }
                    };
                    var e$$0 = {
                        x: 0,
                        y: 0,
                        f: 0,
                        c: 0
                    };
                    return {
                        root: new b$$1(a$$0.X, a$$0.Y, a$$0.fa - a$$0.X, a$$0.ga - a$$0.Y, 0),
                        i: function (a) {
                            this.root.i(a);
                        },
                        t: function (a, b) {
                            this.root.t(a, b);
                        },
                        ia: function (a, b, c, d, f) {
                            e$$0.x = a;
                            e$$0.y = b;
                            e$$0.f = c;
                            e$$0.c = d;
                            this.root.t(e$$0, f);
                        },
                        B: function (a) {
                            return this.root.B(a);
                        },
                        clear: function () {
                            this.root.clear();
                        }
                    };
                }
            };
            g.onload = Wa;
        }
    }
})(window, window.jQuery);
