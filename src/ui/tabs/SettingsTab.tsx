import { SettingsPanel } from '@/ui/panels/ControlPanel';

/** Settings tab isolates rule toggles and session import/export tools. */
export function SettingsTab() {
  return (
    <div className="tab-scroll tab-scroll--settings" role="tabpanel">
      <SettingsPanel />
    </div>
  );
}
