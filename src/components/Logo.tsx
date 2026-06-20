import econLogo from "@/assets/econ-logo.png";

export const Logo = ({ className = "h-10" }: { className?: string; variant?: "dark" | "light" }) => (
  <img
    src={econLogo}
    alt="Econ Escritório Contábil Ltda"
    className={`${className} object-contain`}
    loading="eager"
  />
);
