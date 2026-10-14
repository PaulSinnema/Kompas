// Bridge between device orientation sensor and Blazor
window.kompas = {
    dotNet: null,
    handler: null,
    eventName: null,
    lastSent: 0,
    timeout: null,

    async start(dotNetRef) {
        this.stop();
        this.dotNet = dotNetRef;

        if (!window.isSecureContext) return 'insecure';
        if (typeof DeviceOrientationEvent === 'undefined') return 'unsupported';

        // iOS requires explicit permission
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const result = await DeviceOrientationEvent.requestPermission();
                if (result !== 'granted') return 'denied';
            } catch {
                return 'denied';
            }
        }

        this.eventName = ('ondeviceorientationabsolute' in window) ? 'deviceorientationabsolute' : 'deviceorientation';

        this.handler = e => {
            let heading = null;
            if (typeof e.webkitCompassHeading === 'number') {
                heading = e.webkitCompassHeading; // iOS: already clockwise from north
            } else if (e.alpha !== null && (e.absolute || this.eventName === 'deviceorientationabsolute')) {
                heading = 360 - e.alpha;
            }
            if (heading === null) return;

            // Correct for screen rotation
            const screenAngle = (screen.orientation && screen.orientation.angle) || 0;
            heading = (heading + screenAngle + 360) % 360;

            clearTimeout(this.timeout);
            this.timeout = null;

            // Throttle to ~20 updates per second
            const now = performance.now();
            if (now - this.lastSent < 50) return;
            this.lastSent = now;
            this.dotNet.invokeMethodAsync('OnHeading', heading);
        };

        window.addEventListener(this.eventName, this.handler, true);

        // No data within 3 seconds -> no usable sensor
        this.timeout = setTimeout(() => {
            this.stop();
            if (dotNetRef) dotNetRef.invokeMethodAsync('OnNoSensor');
        }, 3000);

        return 'ok';
    },

    stop() {
        if (this.handler && this.eventName) {
            window.removeEventListener(this.eventName, this.handler, true);
        }
        clearTimeout(this.timeout);
        this.timeout = null;
        this.handler = null;
        this.eventName = null;
    }
};
