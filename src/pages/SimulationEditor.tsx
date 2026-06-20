import { useNavigate, useParams } from "react-router-dom";
import { SimulationEditorCore } from "@/components/SimulationEditor/SimulationEditorCore";

export default function SimulationEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  return (
    <SimulationEditorCore
      id={id !== "nova" ? id : undefined}
      onBack={() => nav("/app/simulacoes")}
      onAfterSave={(newId) => nav(`/app/simulacoes/${newId}`, { replace: true })}
    />
  );
}
