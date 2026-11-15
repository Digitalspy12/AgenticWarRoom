// ============================================
// Nexconn Chat SDK Client Wrapper
// ============================================
// Manages NCEngine initialization, user connection, real-time message events,
// and chat channel operations.

import {
  NCEngine,
  AreaCode,
  GroupChannel,
  MessageHandler,
  SendTextMessageParams,
  BaseChannel,
  GroupChannelIdentifier,
  ConnectionStatusHandler,
  type Message,
} from '@nexconn/chat';

export interface ParsedChatMessage {
  id: string;
  channelId: string;
  senderUserId: string;
  senderName: string;
  sentTime: number;
  text: string;
  customType: string;
  customData: Record<string, unknown>;
  isSystem: boolean;
}

export type NexconnConnectionState = 'connected' | 'connecting' | 'disconnected' | 'kicked';
type ConnectionStateListener = (
  state: NexconnConnectionState,
  detail?: { status: number; code?: number },
) => void;

type MessageListener = (message: ParsedChatMessage) => void;

class NexconnManager {
  private initialized = false;
  private connected = false;
  private currentUserId = '';
  private currentConnectionState: NexconnConnectionState = 'connecting';
  private connectionListeners: Set<ConnectionStateListener> = new Set();
  private listeners: Map<string, Set<MessageListener>> = new Map();

  /**
   * Subscribe to connection status lifecycle events (connected, disconnected, kicked).
   */
  onConnectionStatus(listener: ConnectionStateListener): () => void {
    this.connectionListeners.add(listener);
    listener(this.currentConnectionState);
    return () => {
      this.connectionListeners.delete(listener);
    };
  }

  getConnectionState(): NexconnConnectionState {
    return this.currentConnectionState;
  }

  /**
   * Initialize and connect to Nexconn Chat SDK.
   */
  async connect(userId = 'lead_dev'): Promise<boolean> {
    try {
      // 1. Fetch public config & session token from backend
      const [configRes, tokenRes] = await Promise.all([
        fetch('/api/auth/config').then((r) => r.json()),
        fetch(`/api/auth/token?userId=${encodeURIComponent(userId)}`).then((r) => r.json()),
      ]);

      const appKey = configRes?.appKey;
      const token = tokenRes?.token;

      if (!appKey || !token) {
        console.warn('[Nexconn] Missing appKey or token from backend auth');
        return false;
      }

      // 2. Initialize NCEngine once
      if (!this.initialized) {
        NCEngine.initialize({
          appKey,
          areaCode: AreaCode.SG,
        });
        this.initialized = true;

        // Register global message handler
        NCEngine.addMessageHandler(
          'warroom-handler',
          new MessageHandler({
            onMessageReceived: ({ messages }) => {
              messages.forEach((msg) => this.handleIncomingMessage(msg));
            },
          }),
        );

        // Connection status handler
        NCEngine.addConnectionStatusHandler(
          'warroom-status',
          new ConnectionStatusHandler({
            onConnectionStatusChanged: (event) => {
              const code = event.code;
              const isKicked = code === 6 || code === 31004;
              const nextState: NexconnConnectionState = isKicked
                ? 'kicked'
                : event.status === 0
                  ? 'connected'
                  : event.status === 1
                    ? 'connecting'
                    : 'disconnected';

              console.log('[Nexconn] Connection status changed:', event.status, 'code:', code, '->', nextState);
              this.currentConnectionState = nextState;
              this.connected = nextState === 'connected';
              this.connectionListeners.forEach((fn) => {
                try {
                  fn(nextState, event);
                } catch (err) {
                  console.error('[Nexconn] Connection listener error:', err);
                }
              });
            },
          }),
        );
      }

      // 3. Connect user
      const connectResult = await NCEngine.connect({ token });
      if (connectResult.isOk && connectResult.data?.userId) {
        this.connected = true;
        this.currentUserId = connectResult.data.userId;
        console.log('[Nexconn] Connected successfully as:', this.currentUserId);
        return true;
      } else {
        console.error('[Nexconn] Connect failed:', connectResult);
        return false;
      }
    } catch (err) {
      console.error('[Nexconn] Initialization error:', err);
      return false;
    }
  }

  /**
   * Subscribe to incoming messages for a specific incident channel.
   */
  subscribe(channelId: string, listener: MessageListener): () => void {
    if (!this.listeners.has(channelId)) {
      this.listeners.set(channelId, new Set());
    }
    this.listeners.get(channelId)!.add(listener);

    return () => {
      this.listeners.get(channelId)?.delete(listener);
    };
  }

  /**
   * Send a human message to a group channel.
   */
  async sendMessage(channelId: string, text: string): Promise<boolean> {
    if (!this.connected) {
      console.warn('[Nexconn] Cannot send: not connected');
      return false;
    }

    try {
      const channel = new GroupChannel(channelId);
      const params = new SendTextMessageParams({ text });
      const result = await channel.sendMessage(params);

      if (result.isOk) {
        // Also notify local listeners so sender sees their own message immediately
        const parsed: ParsedChatMessage = {
          id: result.data?.messageId || `local-${Date.now()}`,
          channelId,
          senderUserId: this.currentUserId,
          senderName: this.currentUserId,
          sentTime: result.data?.sentTime || Date.now(),
          text,
          customType: 'TEXT',
          customData: {},
          isSystem: false,
        };
        this.notifyChannel(channelId, parsed);
        return true;
      } else {
        console.error('[Nexconn] Send message error:', result);
        return false;
      }
    } catch (err) {
      console.error('[Nexconn] Send message exception:', err);
      return false;
    }
  }

  /**
   * Load historical messages for a channel.
   */
  async loadHistory(channelId: string, pageSize = 30): Promise<ParsedChatMessage[]> {
    if (!this.connected) return [];

    try {
      const query = BaseChannel.createMessagesQuery({
        channelIdentifier: new GroupChannelIdentifier(channelId),
        pageSize,
      });
      const result = await query.loadNextPage();

      if (result.isOk && Array.isArray(result.data?.data)) {
        return result.data.data.map((m: Message<any>) => this.parseMessage(m));
      }
    } catch (err) {
      console.warn(`[Nexconn] Could not load history for ${channelId}:`, err);
    }
    return [];
  }

  private handleIncomingMessage(msg: Message<any>) {
    const parsed = this.parseMessage(msg);
    this.notifyChannel(parsed.channelId, parsed);
  }

  private notifyChannel(channelId: string, message: ParsedChatMessage) {
    const set = this.listeners.get(channelId);
    if (set) {
      set.forEach((listener) => {
        try {
          listener(message);
        } catch (err) {
          console.error('[Nexconn] Listener exception:', err);
        }
      });
    }
  }

  private parseMessage(msg: Message<any>): ParsedChatMessage {
    const channelId = msg.channelIdentifier?.channelId || '';
    const contentObj = msg.content || {};

    let text = contentObj.text || contentObj.content || '';
    let customType = 'TEXT';
    let customData: Record<string, unknown> = {};
    let senderName = msg.senderUserId || 'Unknown';

    // Parse extra payload if attached (used by server bot messages)
    if (contentObj.extra) {
      try {
        const extra = typeof contentObj.extra === 'string' ? JSON.parse(contentObj.extra) : contentObj.extra;
        if (extra.customType) customType = extra.customType;
        if (extra.customData) customData = extra.customData;
        if (extra.agentName) senderName = extra.agentName;
      } catch {
        // Not a JSON extra payload
      }
    }

    const isSystem = customType === 'SYSTEM_ALERT' || senderName.includes('SYSTEM');

    return {
      id: msg.messageId || `${channelId}-${msg.sentTime}`,
      channelId,
      senderUserId: msg.senderUserId,
      senderName,
      sentTime: msg.sentTime || Date.now(),
      text,
      customType,
      customData,
      isSystem,
    };
  }

  isConnected(): boolean {
    return this.connected;
  }

  getUserId(): string {
    return this.currentUserId;
  }
}

export const nexconn = new NexconnManager();
