// Todas las pantallas de Segundo Cerebro, por grupo y con las palabras con que la gente las busca (buscador 🔍 del encabezado)
import { Bell, CalendarClock, ClipboardCheck, FolderSync, Home, KeyRound, Library, MessageSquareHeart, NotebookPen, RefreshCw, Type, Upload, UserRound } from "lucide-react";
import type { Destino } from "@/components/taos/buscador";

export const GRUPOS = ["Guardar", "Encontrar", "Configurar"] as const;

export const DESTINOS: Destino[] = [
  { ruta: "/subir", nombre: "Subir un documento", detalle: "PDF o foto: la app lo lee", grupo: "Guardar", icono: Upload, palabras: "subir agregar guardar documento foto pdf escanear archivo ine pasaporte poliza ticket" },
  { ruta: "/notas", nombre: "Notas", detalle: "Apuntes rápidos", grupo: "Guardar", icono: NotebookPen, palabras: "notas apuntes escribir nota" },
  { ruta: "/cuenta/drive", nombre: "Conectar Google Drive", detalle: "Tu carpeta se refleja sola", grupo: "Guardar", icono: FolderSync, palabras: "drive google carpeta sincronizar conectar" },
  { ruta: "/", nombre: "Inicio", detalle: "Lo más reciente", grupo: "Encontrar", icono: Home, palabras: "inicio principal buscar" },
  { ruta: "/biblioteca", nombre: "Biblioteca", detalle: "Todos tus documentos", grupo: "Encontrar", icono: Library, palabras: "biblioteca documentos archivos todos lista categorias papeles" },
  { ruta: "/indice", nombre: "Lo que vence", detalle: "Para renovarlo a tiempo", grupo: "Encontrar", icono: CalendarClock, palabras: "vence vencimiento caduca renovar fecha seguro licencia garantia" },
  { ruta: "/mis-documentos", nombre: "Mis documentos", detalle: "Qué tienes, qué falta y cómo tramitarlo", grupo: "Encontrar", icono: ClipboardCheck, palabras: "mis documentos falta faltan tramitar checklist curp acta rfc nss" },
  { ruta: "/cuenta#releer", nombre: "Volver a leer mis documentos", detalle: "Mejora las fichas", grupo: "Configurar", icono: RefreshCw, palabras: "volver leer releer fichas actualizar" },
  { ruta: "/cuenta#avisos", nombre: "Notificaciones", detalle: "Avisos de lo que vence", grupo: "Configurar", icono: Bell, palabras: "notificaciones avisos alertas push recordatorios" },
  { ruta: "/cuenta#pantalla", nombre: "Letra grande", detalle: "Tamaño de la letra", grupo: "Configurar", icono: Type, palabras: "letra grande tamano pantalla tutorial" },
  { ruta: "/cuenta#contrasena", nombre: "Contraseña", detalle: "La misma de tus apps TAOS", grupo: "Configurar", icono: KeyRound, palabras: "contrasena clave password entrar" },
  { ruta: "/sugerencias", nombre: "Sugerencias", detalle: "Ideas, fallas o mejoras para TAOS", grupo: "Configurar", icono: MessageSquareHeart, palabras: "sugerencias sugerencia idea ideas falla error mejora comentario opinion soporte" },
  { ruta: "/cuenta", nombre: "Cuenta", detalle: "Todo lo demás", grupo: "Configurar", icono: UserRound, palabras: "cuenta ajustes configuracion" },
];
