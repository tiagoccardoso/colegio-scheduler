"use client";

import { useEffect, useMemo, useState } from "react";
import { PrintButton } from "@/components/PrintButton";

const ALL_TEACHERS = "__ALL__";
const WEEKDAYS: Record<number, string> = {
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sábado",
  7: "Domingo",
};

function todayIsoLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function fmtDatePtBr(isoDate: string) {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("pt-BR");
}

function shiftLabel(v: string) {
  const k = String(v || "").toUpperCase();
  if (k === "ALL") return "Todos os turnos";
  if (k === "MANHA") return "Manhã";
  if (k === "TARDE") return "Tarde";
  if (k === "NOITE") return "Noite";
  return v;
}

function fmtTime(v: string | null) {
  return v ? String(v).slice(0, 5) : "";
}

type ApiResp = {
  ok: boolean;
  shift: string;
  teacherId: string | null;
  school?: { name: string | null };
  teachers: { id: string; label: string }[];
  items: {
    scheduleId: string;
    teacherId: string;
    teacherName: string;
    replacementTeacherId: string | null;
    replacementTeacherName: string | null;
    shift: string;
    weekday: number;
    periodIndex: number;
    startsAt: string | null;
    endsAt: string | null;
    activityType: "AULA" | "HA" | string;
    className: string;
    subjectName: string;
    roomName: string | null;
    notes: string | null;
  }[];
};

export function GradesAbsencesClient() {
  const [shift, setShift] = useState("ALL");
  const [teacherId, setTeacherId] = useState<string>(ALL_TEACHERS);
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [reportDate, setReportDate] = useState<string>(todayIsoLocal());

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("shift", shift);
    if (teacherId && teacherId !== ALL_TEACHERS) params.set("teacherId", teacherId);

    setLoading(true);
    fetch(`/api/grades/absences?${params.toString()}`)
      .then((r) => r.json())
      .then((j: ApiResp) => setData(j))
      .finally(() => setLoading(false));
  }, [shift, teacherId]);

  const selectedTeacherLabel = useMemo(() => {
    if (teacherId === ALL_TEACHERS) return "Todos os professores";
    return data?.teachers?.find((t) => t.id === teacherId)?.label ?? "";
  }, [data?.teachers, teacherId]);

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Turno</span>
          <select
            value={shift}
            onChange={(e) => setShift(e.target.value)}
            className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <option value="ALL">Todos</option>
            <option value="MANHA">Manhã</option>
            <option value="TARDE">Tarde</option>
            <option value="NOITE">Noite</option>
          </select>
        </label>

        <label className="grid min-w-[260px] gap-1 text-sm">
          <span className="font-medium">Professor</span>
          <select
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <option value={ALL_TEACHERS}>Todos os professores</option>
            {(data?.teachers || []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium">Data do relatório</span>
          <input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          />
        </label>

        <div className="ml-auto">
          <PrintButton className="btn btn-primary">Imprimir</PrintButton>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-900 dark:bg-zinc-950 print:shadow-none">
        <div className="mb-4 flex items-start justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
          <div>
            <div className="text-lg font-bold uppercase tracking-wide">Relatório de faltas e substituições</div>
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              {data?.school?.name || "Escola"} • {shiftLabel(shift)} • {selectedTeacherLabel || "Todos os professores"}
            </div>
          </div>
          <div className="text-right text-xs text-zinc-500 dark:text-zinc-400">
            <div>Emissão</div>
            <div className="font-semibold">{fmtDatePtBr(reportDate)}</div>
          </div>
        </div>

        {loading ? <div className="text-sm text-zinc-600 dark:text-zinc-400">Carregando relatório…</div> : null}

        {!loading && !(data?.items?.length) ? (
          <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
            Nenhuma falta encontrada para os filtros selecionados.
          </div>
        ) : null}

        {data?.items?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border border-zinc-200 bg-zinc-100 p-2 text-left font-semibold dark:border-zinc-800 dark:bg-zinc-900">Professor</th>
                  <th className="border border-zinc-200 bg-zinc-100 p-2 text-left font-semibold dark:border-zinc-800 dark:bg-zinc-900">Substituto</th>
                  <th className="border border-zinc-200 bg-zinc-100 p-2 text-left font-semibold dark:border-zinc-800 dark:bg-zinc-900">Turno</th>
                  <th className="border border-zinc-200 bg-zinc-100 p-2 text-left font-semibold dark:border-zinc-800 dark:bg-zinc-900">Dia / horário</th>
                  <th className="border border-zinc-200 bg-zinc-100 p-2 text-left font-semibold dark:border-zinc-800 dark:bg-zinc-900">Tipo</th>
                  <th className="border border-zinc-200 bg-zinc-100 p-2 text-left font-semibold dark:border-zinc-800 dark:bg-zinc-900">Turma / disciplina / sala</th>
                  <th className="border border-zinc-200 bg-zinc-100 p-2 text-left font-semibold dark:border-zinc-800 dark:bg-zinc-900">Observações</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => {
                  const time = `${fmtTime(item.startsAt)}${item.endsAt ? `–${fmtTime(item.endsAt)}` : ""}`.trim();
                  return (
                    <tr key={item.scheduleId}>
                      <td className="border border-zinc-200 p-2 align-top dark:border-zinc-800">{item.teacherName}</td>
                      <td className="border border-zinc-200 p-2 align-top dark:border-zinc-800">
                        {item.replacementTeacherName ? (
                          <span className="font-medium">{item.replacementTeacherName}</span>
                        ) : (
                          <span className="text-zinc-500 dark:text-zinc-400">Sem substituto</span>
                        )}
                      </td>
                      <td className="border border-zinc-200 p-2 align-top dark:border-zinc-800">{shiftLabel(item.shift)}</td>
                      <td className="border border-zinc-200 p-2 align-top dark:border-zinc-800">
                        <div className="font-medium">{WEEKDAYS[item.weekday] || "—"}</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {item.periodIndex ? `${item.periodIndex}º horário` : "—"}{time ? ` • ${time}` : ""}
                        </div>
                      </td>
                      <td className="border border-zinc-200 p-2 align-top dark:border-zinc-800">
                        {String(item.activityType).toUpperCase() === "HA" ? "Hora Atividade" : "Aula"}
                      </td>
                      <td className="border border-zinc-200 p-2 align-top dark:border-zinc-800">
                        <div className="font-medium">{item.className || "—"}</div>
                        <div className="text-xs text-zinc-600 dark:text-zinc-400">{item.subjectName || "—"}</div>
                        {item.roomName ? <div className="text-xs text-zinc-500 dark:text-zinc-400">Sala: {item.roomName}</div> : null}
                      </td>
                      <td className="border border-zinc-200 p-2 align-top dark:border-zinc-800">{item.notes || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}
