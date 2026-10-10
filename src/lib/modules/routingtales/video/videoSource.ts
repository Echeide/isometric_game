import type Hls from 'hls.js';

export const isHlsSource = (url: string) => /\.m3u8(?:[?#]|$)/i.test(url);

/** One controller per video element. Disposed sources must never affect a replacement. */
export function createVideoSource(
    node: HTMLVideoElement,
    source: string,
    options: {
        onHlsFailure: (reason: string) => void;
        loadHls?: () => Promise<{ default: typeof Hls }>;
    },
) {
    let disposed = false;
    let failed = false;
    let hls: Hls | null = null;
    const fail = (reason: string) => {
        if (disposed || failed) return;
        failed = true;
        // Let the owner replace the element before destroying the old MediaSource.
        options.onHlsFailure(reason);
    };
    const ready = (async () => {
        if (!isHlsSource(source) || node.canPlayType('application/vnd.apple.mpegurl') || node.canPlayType('application/x-mpegURL')) {
            node.src = source;
            node.load();
            return;
        }
        try {
            const { default: HlsClass } = await (options.loadHls ?? (() => import('hls.js')))();
            if (disposed) return;
            if (!HlsClass.isSupported()) {
                fail('hls-unsupported');
                return;
            }
            hls = new HlsClass({
                enableWorker: true,
                abrEwmaDefaultEstimate: 4_000_000,
                testBandwidth: false,
                startLevel: -1,
            });
            hls.on(HlsClass.Events.ERROR, (_event, data) => {
                if (data.fatal) fail('hls-fatal-error');
            });
            hls.loadSource(source);
            hls.attachMedia(node);
        } catch {
            fail('hls-loader-error');
        }
    })();
    return {
        ready,
        destroy() {
            disposed = true;
            hls?.destroy();
            hls = null;
            node.pause();
            node.removeAttribute('src');
            node.load();
        },
    };
}
