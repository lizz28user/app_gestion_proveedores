export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-fp-line px-4 py-4 text-xs text-fp-faint sm:px-6 lg:px-8">
      <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
        <p>
          © {year} Farmacias Peruanas · SIRA · Punta Negra
        </p>
        <p className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="size-1.5 rotate-45 rounded-[1px] bg-[#F02615]"
          />
          Uso interno
        </p>
      </div>
    </footer>
  );
}
