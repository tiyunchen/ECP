import type { ReactNode } from "react";

export function Section({
  number,
  title,
  extra,
  children,
}: {
  number: number;
  title: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="section-card">
      <div className="section-heading">
        <h2>
          <span className="step-number">{number}</span>
          {title}
        </h2>
        {extra}
      </div>
      {children}
    </section>
  );
}
