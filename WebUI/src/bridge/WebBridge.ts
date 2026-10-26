/**
 * ABDAxionikVS — WebBridge.ts
 * Comunicación bidireccional entre WebUI y C++ (WebView2) / WASM
 */

export interface BridgeMessage {
  type: string;
  [key: string]: any;
}

export type MessageHandler = (msg: BridgeMessage) => void;

class WebBridgeImpl {
  private handlers: Set<MessageHandler> = new Set();
  private isNative: boolean = false;

  constructor() {
    this.isNative = typeof (window as any).chrome?.webview?.postMessage === 'function';

    if (this.isNative) {
      (window as any).chrome.webview.addEventListener('message', (event: any) => {
        const data = event.data;
        this.notify(data);
      });
      console.log('[WebBridge] Conectado a WebView2 nativo.');
    } else {
      console.log('[WebBridge] Ejecutando en navegador (modo mock / standalone web).');
    }
  }

  public send(msg: BridgeMessage) {
    if (this.isNative) {
      (window as any).chrome.webview.postMessage(msg);
    } else {
      // Mock echo / dev telemetry
      // console.log('[WebBridge Mock OUT]', msg);
    }
  }

  public setParam(index: number, value: number) {
    this.send({ type: 'PARAM_SET', index, value });
  }

  public noteOn(note: number, velocity: number = 0.8) {
    this.send({ type: 'NOTE_ON', note, velocity });
  }

  public noteOff(note: number) {
    this.send({ type: 'NOTE_OFF', note });
  }

  public onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private notify(msg: BridgeMessage) {
    for (const h of this.handlers) {
      try {
        h(msg);
      } catch (err) {
        console.error('[WebBridge Handler Error]', err);
      }
    }
  }
}

export const WebBridge = new WebBridgeImpl();
