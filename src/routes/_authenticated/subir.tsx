import { createFileRoute } from "@tanstack/react-router";

import { PageHeader, EmptyState } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/subir")({
  head: () => ({
    meta: [
      { title: "Subir video — Evangelio Diario" },
      { name: "description", content: "Sube el video del Evangelio del día a pCloud." },
      { property: "og:title", content: "Subir video — Evangelio Diario" },
      {
        property: "og:description",
        content: "Sube el video del Evangelio del día a pCloud.",
      },
    ],
  }),
  component: SubirVideo,
});

function SubirVideo() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        titulo="Subir video"
        descripcion="El video se enviará directamente desde tu navegador al almacenamiento."
      />
      <EmptyState
        titulo="Disponible en la siguiente fase"
        descripcion="Falta configurar la credencial de pCloud para habilitar la subida directa."
      />
    </div>
  );
}
