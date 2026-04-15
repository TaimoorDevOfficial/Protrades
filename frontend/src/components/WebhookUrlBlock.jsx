import MsIcon from "./MsIcon.jsx";
import { copyText } from "../hooks/useWebhookUrls.js";

export default function WebhookUrlBlock({ title, description, url, icon = "link" }) {
  if (!url) return null;
  return (
    <div className="card-qe border border-outline-variant/10">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-container-high">
          <MsIcon name={icon} className="text-xl text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-headline text-sm font-semibold text-on-surface">{title}</h3>
          {description ? <p className="mt-1 text-xs text-on-surface-variant">{description}</p> : null}
          <code className="mt-3 block break-all rounded-md bg-surface-container-low px-3 py-2 text-[11px] text-primary/90">
            {url}
          </code>
          <button
            type="button"
            onClick={() => copyText(url)}
            className="mt-3 rounded-md border border-outline-variant/20 px-3 py-1.5 text-xs font-medium text-on-surface hover:bg-surface-container-high"
          >
            Copy URL
          </button>
        </div>
      </div>
    </div>
  );
}
