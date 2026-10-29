import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";

// Aquí llega el enlace mágico del correo: se canjea por una sesión
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const db = await clienteServidor();
  const codigo = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const tipo = url.searchParams.get("type") as EmailOtpType | null;

  const resultado = codigo
    ? await db.auth.exchangeCodeForSession(codigo)
    : tokenHash && tipo
      ? await db.auth.verifyOtp({ token_hash: tokenHash, type: tipo })
      : { error: { message: url.searchParams.get("error_code") === "otp_expired" ? "El enlace ya se usó o caducó. Pide uno nuevo." : "Enlace incompleto" } };

  if (resultado.error) return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(resultado.error.message)}`, url));
  return NextResponse.redirect(new URL("/", url));
}
