import { useRef } from "react";
import { ArrowUpRight, Sparkles, X } from "lucide-react";

export default function ProEntry() {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        className="rpv-pro-entry"
        onClick={() => dialog.current?.showModal()}
        aria-haspopup="dialog"
      >
        <Sparkles size={17} aria-hidden="true" />
        Перейти на Pro <ArrowUpRight size={16} aria-hidden="true" />
      </button>
      <dialog
        ref={dialog}
        className="rpv-pro-dialog"
        aria-labelledby="rpv-pro-title"
        aria-describedby="rpv-pro-description"
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <div className="rpv-pro-content">
          <div className="rpv-pro-top">
            <span className="rpv-pro-badge"><Sparkles size={15} /> RPV Pro</span>
            <button autoFocus aria-label="Закрити" onClick={() => dialog.current?.close()}><X size={20} /></button>
          </div>
          <span className="rpv-pro-status">У розробці</span>
          <h2 id="rpv-pro-title">Pro-кабінет у розробці</h2>
          <p id="rpv-pro-description">Готуємо окремий простір для регіональних менеджерів — уся ваша мережа та її аналітика в одному кабінеті.</p>
          <ul>
            <li>Огляд мережі за регіонами та об’єктами</li>
            <li>Обсяги відкачки й динаміка за місяцями</li>
            <li>Статистика та історія обслуговування</li>
          </ul>
          <p className="rpv-pro-note">Кабінет для перегляду статистики й контролю мережі, без створення заявок. Доступ відкриємо після запуску.</p>
          <button className="primary" onClick={() => dialog.current?.close()}>Зрозуміло</button>
        </div>
      </dialog>
    </>
  );
}
