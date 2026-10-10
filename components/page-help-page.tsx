"use client";

import { PAGE_HELP } from "@/lib/page-help";
import { HelpedView } from "@/lib/routes";

// Page d'aide d'un écran : à quoi il sert, comment s'en servir, questions fréquentes.
export function PageHelpPage({ view, onBack }: { view: HelpedView; onBack: () => void }) {
  const help = PAGE_HELP[view];
  return (
    <div className="content-scroll">
      <div className="page-intro">
        <div>
          <p className="eyebrow">Info sur la page</p>
          <h2>{view}</h2>
          <p>{help.summary}</p>
        </div>
        <button className="secondary-button" onClick={onBack}>Retour à la page</button>
      </div>
      <section className="panel full-panel page-help">
        <h3>À quoi sert cette page</h3>
        <ul>{help.purpose.map((item) => <li key={item}>{item}</li>)}</ul>

        <h3>Comment l&apos;utiliser</h3>
        <ol className="page-help-steps">
          {help.steps.map((step) => <li key={step.title}><strong>{step.title}</strong><p>{step.detail}</p></li>)}
        </ol>

        {help.tips?.length ? <>
          <h3>Bon à savoir</h3>
          <ul>{help.tips.map((item) => <li key={item}>{item}</li>)}</ul>
        </> : null}

        <h3>Questions fréquentes</h3>
        <div className="page-help-faq">
          {help.faq.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}
        </div>
        <button className="primary-button compact" onClick={onBack}>J&apos;ai compris, retour à la page</button>
      </section>
    </div>
  );
}
