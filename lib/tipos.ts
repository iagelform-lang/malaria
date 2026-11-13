export type EstadoJuntada = "propuesta" | "activa" | "finalizada" | "cancelada";
export type OrigenRegistro = "qr" | "manual" | "auto_fin" | "auto_12h";

export type Perfil = {
  id: string;
  apodo: string;
  avatar_url: string | null;
  rol: "admin" | "invitado";
};

export type Juntada = {
  id: string;
  nombre: string;
  lugar: string | null;
  inicio_programado: string;
  tolerancia_min: number;
  estado: EstadoJuntada;
  anfitrion_id: string;
  iniciada_en: string | null;
  finalizada_en: string | null;
};

export type Confirmacion = {
  juntada_id: string;
  perfil_id: string;
  hora_prometida: string;
};

export type Asistencia = {
  id: number;
  juntada_id: string;
  perfil_id: string;
  entrada: string;
  salida: string | null;
  origen_salida: OrigenRegistro | null;
  duracion_min: number | null;
};

export type Estadistica = {
  perfil_id: string;
  apodo: string;
  juntadas_asistidas: number;
  juntadas_posibles: number;
  pct_asistencia: number | null;
  horas_totales: number;
  promedio_min_por_juntada: number | null;
  pct_puntualidad: number | null;
  veces_dijo_hora: number;
  veces_primero: number;
  veces_ultimo: number;
  veces_planto: number;
  elegible_fantasma: boolean;
};

export type ResultadoEscaneo = {
  r_accion: "entrada" | "salida" | "ignorado";
  r_perfil_id: string;
  r_apodo: string;
  r_duracion_min: number | null;
};
