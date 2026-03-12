import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isStaffRole } from "@/lib/authz";
import { normalizeGradeSolverSettings } from "@/lib/schedule/solver-settings";
import {
  teacherAcceptsShift,
  teacherAllowedForClass,
  teacherAllowsSubject,
  teacherAvailable,
} from "@/lib/teacher-rules";

export function normalizeShift(v: any) {
  const key = String(v ?? "").trim().toUpperCase();
  if (!key) return "MANHA";
  if (key.startsWith("MAN")) return "MANHA";
  if (key.startsWith("TAR")) return "TARDE";
  if (key.startsWith("NOI")) return "NOITE";
  return key;
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function isMissingRelationError(error: any) {
  const code = String(error?.code ?? "");
  const msg = String(error?.message ?? "").toLowerCase();
  return (
    code === "42P01" ||
    code === "42703" ||
    (msg.includes("relation") && msg.includes("does not exist")) ||
    (msg.includes("column") && msg.includes("does not exist"))
  );
}

export async function requireStaffApi() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("school_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.school_id || !isStaffRole((profile as any).role)) return null;
  return { supabase, user, profile: profile as { school_id: string; role: string } };
}

export async function loadMatrixState(args: { supabase: any; schoolId: string; shift: string }) {
  const { supabase, schoolId, shift } = args;

  const [schoolRes, classesRes, subjectsRes, timeSlotsRes, requirementsRes, settingsRes, teachersRes] = await Promise.all([
    supabase.from("schools").select("id,name").eq("id", schoolId).maybeSingle(),
    supabase
      .from("classes")
      .select("id,name,shift,display_order")
      .eq("school_id", schoolId)
      .eq("shift", shift)
      .order("display_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true }),
    supabase.from("subjects").select("id,name").eq("school_id", schoolId).order("name", { ascending: true }),
    supabase
      .from("time_slots")
      .select("id,weekday,shift,period_index,starts_at,ends_at")
      .eq("school_id", schoolId)
      .eq("shift", shift)
      .in("weekday", [1, 2, 3, 4, 5])
      .order("weekday", { ascending: true })
      .order("period_index", { ascending: true }),
    supabase.from("class_subject_requirements").select("id,class_id,subject_id,lessons_per_week").eq("school_id", schoolId),
    supabase.from("schedule_solver_settings").select("*").eq("school_id", schoolId).maybeSingle(),
    supabase
      .from("teachers")
      .select("id,name,shifts,subject_id,subject_ids,class_ids,availability,default_room_id,teaching_rules")
      .eq("school_id", schoolId)
      .order("name", { ascending: true }),
  ]);

  const classesData = (classesRes.data as any[]) ?? [];
  const classIdSet = new Set(classesData.map((item: any) => String(item.id)));
  const timeSlots = (timeSlotsRes.data as any[]) ?? [];
  const timeSlotIds = timeSlots.map((item: any) => String(item.id));

  let cells: any[] = [];
  if (timeSlotIds.length) {
    const cellsRes = await supabase
      .from("curriculum_matrix_slots")
      .select("id,class_id,time_slot_id,subject_id,teacher_id,notes")
      .eq("school_id", schoolId)
      .in("time_slot_id", timeSlotIds);
    if (cellsRes.error) {
      if (isMissingRelationError(cellsRes.error)) {
        return { missingTable: true };
      }
      throw new Error(cellsRes.error.message || "Falha ao carregar a matriz curricular.");
    }
    cells = ((cellsRes.data as any[]) ?? []).filter((item: any) => classIdSet.has(String(item.class_id)));
  }

  return {
    ok: true,
    shift,
    school: { name: (schoolRes.data as any)?.name ?? null },
    classes: classesData.map((item: any) => ({
      id: String(item.id),
      name: item.name ? String(item.name) : null,
      shift: item.shift ? String(item.shift) : null,
      display_order: item.display_order === null || item.display_order === undefined ? null : Number(item.display_order),
    })),
    subjects: ((subjectsRes.data as any[]) ?? []).map((item: any) => ({
      id: String(item.id),
      name: item.name ? String(item.name) : null,
    })),
    teachers: ((teachersRes.data as any[]) ?? []).map((item: any) => ({
      id: String(item.id),
      name: item.name ? String(item.name) : null,
      shifts: Array.isArray(item.shifts) ? item.shifts.map(String) : [],
      subject_id: item.subject_id ? String(item.subject_id) : null,
      subject_ids: Array.isArray(item.subject_ids) ? item.subject_ids.map(String) : [],
      class_ids: Array.isArray(item.class_ids) ? item.class_ids.map(String) : [],
      availability: item.availability ?? null,
      default_room_id: item.default_room_id ? String(item.default_room_id) : null,
      teaching_rules: Array.isArray(item.teaching_rules) ? item.teaching_rules : [],
    })),
    timeSlots: timeSlots.map((item: any) => ({
      id: String(item.id),
      weekday: Number(item.weekday ?? 0),
      shift: item.shift ? String(item.shift) : null,
      period_index: item.period_index === null || item.period_index === undefined ? null : Number(item.period_index),
      starts_at: item.starts_at ? String(item.starts_at) : null,
      ends_at: item.ends_at ? String(item.ends_at) : null,
    })),
    requirements: ((requirementsRes.data as any[]) ?? []).filter((item: any) => classIdSet.has(String(item.class_id))).map((item: any) => ({
      id: String(item.id),
      class_id: String(item.class_id),
      subject_id: String(item.subject_id),
      lessons_per_week: Number(item.lessons_per_week ?? 0),
    })),
    cells: cells.map((item: any) => ({
      id: String(item.id),
      class_id: String(item.class_id),
      time_slot_id: String(item.time_slot_id),
      subject_id: String(item.subject_id),
      teacher_id: item.teacher_id ? String(item.teacher_id) : null,
      notes: item.notes ? String(item.notes) : null,
    })),
    settings: normalizeGradeSolverSettings(settingsRes.data ?? {}),
  };
}

export function teacherMatchesMatrixCell(args: {
  teacher: any;
  classId: string;
  subjectId: string;
  shift: string;
  slot: { weekday: number; period_index: number | null };
}) {
  const { teacher, classId, subjectId, shift, slot } = args;
  if (!teacher) return false;
  if (!teacherAcceptsShift(teacher, shift)) return false;
  if (!teacherAllowedForClass(teacher, classId)) return false;
  if (!teacherAllowsSubject(teacher, subjectId)) return false;
  if (
    !teacherAvailable(teacher, {
      shift,
      weekday: Number(slot.weekday ?? 0),
      period_index: Number(slot.period_index ?? 0),
    })
  ) {
    return false;
  }
  return true;
}
