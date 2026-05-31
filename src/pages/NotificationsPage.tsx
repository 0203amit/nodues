import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Bell, BellOff, Loader2, Send, Info, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useBootstrap } from '../contexts/BootstrapContext';
import { useToast } from '../contexts/ToastContext';
import {
  ensurePushSubscriptionsTab,
  readPushSubscriptions,
  createPushSubscription,
  softDeletePushSubscription,
  updateDeliveryTime,
} from '../services/pushSubscriptionsService';
import { appendActivityLogSafe } from '../services/activityLogService';
import { formatRelativeTime } from '../utils/relativeTime';
import { APP_TITLE_SUFFIX } from '../config/branding';
import { v4 as uuidv4 } from 'uuid';
import type { PushSubscription } from '../types';

// --- Helper ---

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// --- Component ---

export default function NotificationsPage() {
  const { accessToken } = useAuth();
  const { setupResult } = useBootstrap();
  const spreadsheetId = setupResult!.spreadsheetId;
  const { showToast } = useToast();

  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

  // --- State ---
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [permissionState, setPermissionState] = useState<NotificationPermission | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [deliveryTime, setDeliveryTime] = useState('08:00');
  const [isUpdatingTime, setIsUpdatingTime] = useState(false);

  // --- Document title ---
  useEffect(() => {
    document.title = `${APP_TITLE_SUFFIX} \u00b7 Notifications`;
  }, []);

  // --- Check browser support + load subscription ---
  const loadSubscription = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setIsSupported(false);
      setIsLoading(false);
      return;
    }

    setPermissionState(Notification.permission);

    try {
      await ensurePushSubscriptionsTab(accessToken!, spreadsheetId);
      const subs = await readPushSubscriptions(accessToken!, spreadsheetId);
      const active = subs.find((s) => s.enabled) ?? null;
      setSubscription(active);
      if (active) {
        const h = String(active.deliveryHour).padStart(2, '0');
        const m = String(active.deliveryMinute).padStart(2, '0');
        setDeliveryTime(`${h}:${m}`);
      }
    } catch {
      showToast('Failed to load notification settings.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, spreadsheetId, showToast]);

  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  // --- Toggle ON ---
  async function handleEnable() {
    if (!vapidPublicKey) {
      showToast('Push notifications not configured. VAPID key is missing.', 'error');
      return;
    }

    setIsToggling(true);
    try {
      const permission = await Notification.requestPermission();
      setPermissionState(permission);

      if (permission === 'denied') {
        showToast('Notifications are blocked. Check your browser settings to allow them.', 'info');
        setIsToggling(false);
        return;
      }
      if (permission === 'default') {
        // User dismissed the prompt
        setIsToggling(false);
        return;
      }

      // permission === 'granted'
      const registration = await navigator.serviceWorker.ready;
      const pushSub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer,
      });

      const rawKey = pushSub.getKey('p256dh');
      const rawAuth = pushSub.getKey('auth');
      const p256dhKey = rawKey ? btoa(String.fromCharCode(...new Uint8Array(rawKey))) : '';
      const authKey = rawAuth ? btoa(String.fromCharCode(...new Uint8Array(rawAuth))) : '';

      const [hours, minutes] = deliveryTime.split(':').map(Number);

      const subId = await createPushSubscription(accessToken!, spreadsheetId, {
        endpoint: pushSub.endpoint,
        p256dhKey,
        authKey,
        deliveryHour: hours,
        deliveryMinute: minutes,
      });

      await appendActivityLogSafe(accessToken!, spreadsheetId, {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        userEmail: 'user',
        action: 'push_enabled',
        entityType: 'push_subscription',
        entityId: subId,
        summary: 'Push notifications enabled',
      });

      // Reload to get the full subscription with _rowIndex
      const subs = await readPushSubscriptions(accessToken!, spreadsheetId);
      const active = subs.find((s) => s.id === subId) ?? null;
      setSubscription(active);
      showToast('Push notifications enabled.', 'success');
    } catch {
      showToast('Failed to enable push notifications.', 'error');
    } finally {
      setIsToggling(false);
    }
  }

  // --- Toggle OFF ---
  async function handleDisable() {
    if (!subscription) return;

    setIsToggling(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const pushSub = await registration.pushManager.getSubscription();
      if (pushSub) {
        await pushSub.unsubscribe();
      }

      await softDeletePushSubscription(accessToken!, spreadsheetId, subscription._rowIndex);

      await appendActivityLogSafe(accessToken!, spreadsheetId, {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        userEmail: 'user',
        action: 'push_disabled',
        entityType: 'push_subscription',
        entityId: subscription.id,
        summary: 'Push notifications disabled',
      });

      setSubscription(null);
      showToast('Push notifications disabled.', 'success');
    } catch {
      showToast('Failed to disable push notifications.', 'error');
    } finally {
      setIsToggling(false);
    }
  }

  // --- Delivery time change ---
  async function handleDeliveryTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newTime = e.target.value;
    setDeliveryTime(newTime);

    if (!subscription) return;

    setIsUpdatingTime(true);
    try {
      const [hours, minutes] = newTime.split(':').map(Number);
      await updateDeliveryTime(accessToken!, spreadsheetId, subscription._rowIndex, hours, minutes);
      setSubscription({ ...subscription, deliveryHour: hours, deliveryMinute: minutes });
      showToast('Delivery time updated.', 'success');
    } catch {
      showToast('Failed to update delivery time.', 'error');
    } finally {
      setIsUpdatingTime(false);
    }
  }

  // --- Test notification ---
  async function handleTestNotification() {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification('NoDues', {
        body: 'Test notification \u2014 push is working!',
        tag: 'nodues-test',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
      });
    } catch {
      showToast('Failed to show test notification.', 'error');
    }
  }

  const isEnabled = subscription !== null;

  // --- Render ---
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-3xl mx-auto pb-24">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/settings"
          className="inline-flex items-center gap-1 text-sm font-medium text-indigo-700 hover:text-indigo-800
                     transition-colors cursor-pointer mb-2
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 rounded"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Settings
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">Notifications</h1>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-indigo-700 animate-spin" />
        </div>
      )}

      {/* Unsupported browser */}
      {!isLoading && !isSupported && (
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-base font-semibold text-slate-900">Not supported</p>
              <p className="text-sm text-slate-600 mt-1">
                Push notifications are not supported in this browser. Try opening NoDues in Chrome or Safari.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* VAPID not configured */}
      {!isLoading && isSupported && !vapidPublicKey && (
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-base font-semibold text-slate-900">Push notifications not configured</p>
              <p className="text-sm text-slate-600 mt-1">
                The VAPID public key has not been set. Push notifications will be available after the server is configured.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      {!isLoading && isSupported && (
        <div className="flex flex-col gap-4">
          {/* Enable/Disable toggle card */}
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {isEnabled ? (
                  <Bell className="w-5 h-5 text-indigo-700 flex-shrink-0" />
                ) : (
                  <BellOff className="w-5 h-5 text-slate-400 flex-shrink-0" />
                )}
                <div>
                  <p className="text-base font-semibold text-slate-900">
                    Daily overdue reminders
                  </p>
                  <p className="text-sm text-slate-600">
                    Get notified about overdue bills and to-dos
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isEnabled}
                disabled={isToggling || !vapidPublicKey}
                onClick={isEnabled ? handleDisable : handleEnable}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent
                  transition-colors duration-200 ease-in-out cursor-pointer
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${isEnabled ? 'bg-indigo-700' : 'bg-slate-200'}`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0
                    transition duration-200 ease-in-out
                    ${isEnabled ? 'translate-x-5' : 'translate-x-0'}`}
                />
                {isToggling && (
                  <Loader2 className="absolute inset-0 m-auto w-4 h-4 text-indigo-700 animate-spin" />
                )}
              </button>
            </div>
          </div>

          {/* Status indicator */}
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  isEnabled ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
              />
              <span className="text-sm font-medium text-slate-700">
                {isEnabled ? 'Subscribed' : 'Not subscribed'}
              </span>
            </div>
            {isEnabled && subscription?.lastPushedAt && (
              <p className="text-sm text-slate-500 mt-1 ml-4">
                Last notification: {formatRelativeTime(subscription.lastPushedAt)}
              </p>
            )}
          </div>

          {/* Delivery time picker — visible when enabled */}
          {isEnabled && (
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Delivery time</span>
                <p className="text-sm text-slate-500 mt-0.5 mb-2">
                  When to receive your daily overdue summary
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={deliveryTime}
                    onChange={handleDeliveryTimeChange}
                    disabled={isUpdatingTime}
                    className="block w-auto rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900
                      focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
                      disabled:opacity-50"
                  />
                  {isUpdatingTime && (
                    <Loader2 className="w-4 h-4 text-indigo-700 animate-spin" />
                  )}
                </div>
              </label>
            </div>
          )}

          {/* Test notification button */}
          {isEnabled && (
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <button
                type="button"
                onClick={handleTestNotification}
                className="inline-flex items-center gap-2 text-sm font-medium text-indigo-700 hover:text-indigo-800
                  transition-colors cursor-pointer
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 rounded"
              >
                <Send className="w-4 h-4" />
                Send test notification
              </button>
              <p className="text-sm text-slate-500 mt-1">
                Sends a local test to verify notifications are working
              </p>
            </div>
          )}

          {/* Permission denied guidance */}
          {permissionState === 'denied' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Notifications blocked</p>
                  <p className="text-sm text-amber-700 mt-1">
                    You previously blocked notifications for this site. To enable them:
                  </p>
                  <ol className="text-sm text-amber-700 mt-2 list-decimal list-inside space-y-1">
                    <li>Click the lock/info icon in your browser&apos;s address bar</li>
                    <li>Find &quot;Notifications&quot; and change it to &quot;Allow&quot;</li>
                    <li>Reload the page and try again</li>
                  </ol>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
