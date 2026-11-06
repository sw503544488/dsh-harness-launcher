/**
 * dsh-harness-launcher — Client half.
 *
 * Adds one sidebar entry and its central panel: live status for this Host, the
 * desktop-shortcut action, and the restart / close pair. Every privileged step
 * runs through the Host API registered by `index.js`; this half only renders.
 */
window.__ModuleLoader__.load({
  id: 'dsh-harness-launcher',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useCallback, useEffect, useRef, useState } = React;

    const NS = 'harness-launcher';
    const API = '/plugins/harness-launcher/api';
    const PANEL_KEY = 'harness-launcher';
    const PANEL_ORDER = 45;

    const DICT = {
      en: {
        'title': 'Harness launcher',
        'subtitle': 'One desktop icon: starts the Host hidden when it is stopped, opens the UI when it is running.',
        'status.running': 'Running',
        'status.unknown': 'Checking…',
        'row.pid': 'Process',
        'row.address': 'Address',
        'row.command': 'Command',
        'row.icon': 'Desktop icon',
        'icon.exists': 'Created',
        'icon.missing': 'Not created',
        'icon.unsupported': 'Windows only',
        'action.icon': 'Create / refresh desktop icon',
        'action.open': 'Open in browser',
        'action.restart': 'Restart',
        'action.close': 'Close',
        'confirm.restart': 'Click again to restart',
        'confirm.close': 'Click again to close',
        'danger.title': 'Stop or restart this instance',
        'danger.hint': 'This page disconnects immediately. A restart reopens the browser once the new instance answers.',
        'notice.icon': 'Desktop shortcut ready: {{path}}',
        'notice.open': 'Opened in the default browser.',
        'notice.restart': 'Restart requested. The browser reopens when the Host is back.',
        'notice.close': 'Close requested. This page will disconnect.',
        'notice.failed': 'Failed: {{message}}',
        'notice.loading': 'Loading status…',
      },
      zh: {
        'title': 'Harness 启动器',
        'subtitle': '一个桌面图标：没跑就隐藏窗口启动，在跑就直接打开界面。',
        'status.running': '运行中',
        'status.unknown': '正在检查…',
        'row.pid': '进程',
        'row.address': '地址',
        'row.command': '启动命令',
        'row.icon': '桌面图标',
        'icon.exists': '已生成',
        'icon.missing': '未生成',
        'icon.unsupported': '仅 Windows',
        'action.icon': '生成 / 更新桌面图标',
        'action.open': '在浏览器中打开',
        'action.restart': '重启',
        'action.close': '关闭',
        'confirm.restart': '再次点击确认重启',
        'confirm.close': '再次点击确认关闭',
        'danger.title': '停止或重启当前实例',
        'danger.hint': '当前页面会立刻断开；重启完成后，新实例就绪时自动打开浏览器。',
        'notice.icon': '桌面快捷方式已就绪：{{path}}',
        'notice.open': '已在默认浏览器中打开。',
        'notice.restart': '已发送重启指令，Host 恢复后会自动打开浏览器。',
        'notice.close': '已发送关闭指令，当前页面即将断开。',
        'notice.failed': '失败：{{message}}',
        'notice.loading': '正在读取状态…',
      },
    };

    const CSS = `
.hl-root {
  box-sizing: border-box;
  max-width: 760px;
  margin: 0 auto;
  padding: 32px 32px 48px;
  color: var(--dsw-alias-label-primary);
}
.hl-title {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.hl-sub {
  margin: 0 0 24px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--dsw-alias-label-secondary);
}
.hl-card {
  margin: 0 0 16px;
  padding: 16px 18px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-1);
}
.hl-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 600;
}
.hl-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--dsw-alias-state-success-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-state-success-primary) 18%, transparent);
}
.hl-dot-pending { background: var(--dsw-alias-state-idle-primary); box-shadow: none; }
.hl-row {
  display: flex;
  gap: 12px;
  padding: 5px 0;
  font-size: 13px;
  align-items: baseline;
}
.hl-key {
  flex: 0 0 96px;
  color: var(--dsw-alias-label-secondary);
}
.hl-val {
  flex: 1 1 auto;
  min-width: 0;
  word-break: break-all;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
}
.hl-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 14px;
}
.hl-btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  line-height: 1.4;
  cursor: pointer;
  transition: background-color 120ms ease;
}
.hl-btn:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-2); }
.hl-btn:disabled { opacity: 0.5; cursor: default; }
.hl-btn-primary {
  border-color: transparent;
  background: var(--dsw-alias-brand-primary);
  color: #fff;
}
.hl-btn-primary:hover:not(:disabled) {
  background: var(--dsw-alias-brand-primary);
  filter: brightness(1.06);
}
.hl-btn-danger { color: var(--dsw-alias-state-error-primary); border-color: var(--dsw-alias-border-l1); }
.hl-btn-danger:hover:not(:disabled) { border-color: var(--dsw-alias-state-error-primary); }
/* The armed state owns its hover: the shared hover rule must never repaint it,
   and it must not inherit the 120ms background fade — white text on the still
   light surface is the flash this rule exists to prevent. */
.hl-btn-danger-armed,
.hl-btn-danger-armed:focus-visible,
.hl-btn-danger-armed:hover:not(:disabled) {
  background: var(--dsw-alias-state-error-primary);
  border-color: transparent;
  color: #fff;
  font-weight: 600;
  transition: none;
}
.hl-hint {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--dsw-alias-label-secondary);
}
.hl-notice {
  margin: 16px 0 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2);
  font-size: 12px;
  line-height: 1.6;
}
.hl-notice-error { color: var(--dsw-alias-state-error-primary); }
`;

    /** Call the Host API and unwrap `{ ok, value }`. */
    async function request(method, options) {
      const init = {
        method: method === 'status' || method === 'url' ? 'GET' : 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'x-dsh-launcher': '1' },
        ...options,
      };
      if (init.method === 'POST') {
        init.headers = { ...init.headers, 'content-type': 'application/json' };
        init.body = init.body ?? '{}';
      }
      const response = await fetch(`${API}/${method}`, init);
      const payload = await response.json().catch(() => null);
      if (payload === null || payload.ok !== true) {
        throw new Error(payload?.error?.message ?? `HTTP ${response.status}`);
      }
      return payload.value;
    }

    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    /** Translate with a `{{name}}` substitution. */
    function fill(template, values) {
      return String(template).replace(/\{\{(\w+)\}\}/gu, (match, key) => (values[key] === undefined ? match : String(values[key])));
    }

    function Row({ label, value }) {
      return h('div', { className: 'hl-row' }, h('span', { className: 'hl-key' }, label), h('span', { className: 'hl-val' }, value));
    }

    function Panel(props) {
      const t = typeof props.t === 'function' ? props.t : (key) => key;
      const [status, setStatus] = useState(null);
      const [busy, setBusy] = useState(null);
      const [notice, setNotice] = useState(null);
      const [failed, setFailed] = useState(false);
      const [armed, setArmed] = useState(null);
      const armTimer = useRef(null);

      const refresh = useCallback(async () => {
        try {
          setStatus(await request('status'));
        } catch (cause) {
          setFailed(true);
          setNotice(fill(t('notice.failed'), { message: cause.message }));
        }
      }, [t]);

      useEffect(() => {
        void refresh();
        return () => {
          if (armTimer.current !== null) clearTimeout(armTimer.current);
        };
      }, [refresh]);

      const disarm = () => {
        if (armTimer.current !== null) clearTimeout(armTimer.current);
        armTimer.current = null;
        setArmed(null);
      };

      const report = (message, isError = false) => {
        setFailed(isError);
        setNotice(message);
      };

      const createIcon = async () => {
        setBusy('icon');
        disarm();
        try {
          const value = await request('icon');
          if (value?.ok === false) {
            report(fill(t('notice.failed'), { message: value.reason }), true);
          } else {
            report(fill(t('notice.icon'), { path: value.path }));
            await refresh();
          }
        } catch (cause) {
          report(fill(t('notice.failed'), { message: cause.message }), true);
        } finally {
          setBusy(null);
        }
      };

      const openUi = async () => {
        setBusy('open');
        disarm();
        try {
          await request('open');
          report(t('notice.open'));
        } catch (cause) {
          report(fill(t('notice.failed'), { message: cause.message }), true);
        } finally {
          setBusy(null);
        }
      };

      const lifecycle = async (action) => {
        if (armed !== action) {
          setArmed(action);
          if (armTimer.current !== null) clearTimeout(armTimer.current);
          armTimer.current = setTimeout(() => {
            armTimer.current = null;
            setArmed(null);
          }, 5000);
          return;
        }
        disarm();
        setBusy(action);
        // The Host dies before it can answer; never wait for the response.
        await Promise.race([request(action).catch(() => undefined), wait(1500)]);
        report(t(action === 'restart' ? 'notice.restart' : 'notice.close'));
        setBusy(null);
      };

      const running = status !== null;
      const iconLabel = status === null
        ? t('notice.loading')
        : status.platform !== 'win32'
          ? t('icon.unsupported')
          : status.icon.exists
            ? t('icon.exists')
            : t('icon.missing');
      const iconValue = status !== null && status.platform === 'win32' ? status.icon.path : iconLabel;

      return h(
        'div',
        { className: 'hl-root' },
        h('style', { key: 'css' }, CSS),
        h('h1', { className: 'hl-title' }, t('title')),
        h('p', { className: 'hl-sub' }, t('subtitle')),
        h(
          'section',
          { className: 'hl-card' },
          h(
            'div',
            { className: 'hl-head' },
            h('span', { className: running ? 'hl-dot' : 'hl-dot hl-dot-pending' }),
            h('span', null, running ? t('status.running') : t('status.unknown')),
          ),
          h(Row, { label: t('row.address'), value: status?.origin ?? '—' }),
          h(Row, { label: t('row.pid'), value: status?.pid ?? '—' }),
          h(Row, { label: t('row.command'), value: status?.dshCommand ?? '—' }),
          h(Row, { label: t('row.icon'), value: iconValue }),
          h(
            'div',
            { className: 'hl-actions' },
            h(
              'button',
              { type: 'button', className: 'hl-btn hl-btn-primary', onClick: createIcon, disabled: busy !== null },
              t('action.icon'),
            ),
            h('button', { type: 'button', className: 'hl-btn', onClick: openUi, disabled: busy !== null }, t('action.open')),
          ),
        ),
        h(
          'section',
          { className: 'hl-card' },
          h('div', { className: 'hl-head' }, t('danger.title')),
          h('p', { className: 'hl-hint' }, t('danger.hint')),
          h(
            'div',
            { className: 'hl-actions' },
            h(
              'button',
              {
                type: 'button',
                className: `hl-btn hl-btn-danger${armed === 'restart' ? ' hl-btn-danger-armed' : ''}`,
                onClick: () => void lifecycle('restart'),
                disabled: busy !== null,
              },
              t(armed === 'restart' ? 'confirm.restart' : 'action.restart'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: `hl-btn hl-btn-danger${armed === 'close' ? ' hl-btn-danger-armed' : ''}`,
                onClick: () => void lifecycle('close'),
                disabled: busy !== null,
              },
              t(armed === 'close' ? 'confirm.close' : 'action.close'),
            ),
          ),
        ),
        notice === null ? null : h('div', { className: `hl-notice${failed ? ' hl-notice-error' : ''}` }, notice),
      );
    }

    function SidebarIcon(props) {
      const size = typeof props.size === 'number' && props.size > 0 ? props.size : 20;
      return h(
        'svg',
        { viewBox: '0 0 48 48', width: size, height: size, 'aria-hidden': true, style: { display: 'block' } },
        h(
          'defs',
          null,
          h(
            'linearGradient',
            { id: 'hl-tile-sidebar', x1: '0', y1: '0', x2: '0', y2: '1' },
            h('stop', { offset: '0', stopColor: '#3f86f5' }),
            h('stop', { offset: '1', stopColor: '#1d40b0' }),
          ),
        ),
        h('rect', { x: '0', y: '0', width: '48', height: '48', rx: '9.6', fill: 'url(#hl-tile-sidebar)' }),
        h('path', {
          d: 'M13 16.8 L21.6 24 L13 31.2',
          fill: 'none',
          stroke: '#ffffff',
          strokeWidth: '4.1',
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
        h('rect', { x: '25.4', y: '28.9', width: '9.6', height: '4.1', rx: '2.05', fill: '#ffffff' }),
      );
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        for (const [locale, dict] of Object.entries(DICT)) {
          ctx.effect(() => ctx.locale.register(NS, locale, dict), `dsh-harness-launcher: ${locale} texts`);
        }
        const t = ctx.locale.bind(NS);

        ctx.effect(
          () => ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_KEY, locale: NS }, Panel)),
          'dsh-harness-launcher: main panel',
        );
        ctx.effect(
          () => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
            name: 'sidebar.panellist',
            id: PANEL_KEY,
            order: PANEL_ORDER,
            label: () => t('title'),
            locale: NS,
          }, SidebarIcon)),
          'dsh-harness-launcher: sidebar entry',
        );
      },
    };
  },
});
