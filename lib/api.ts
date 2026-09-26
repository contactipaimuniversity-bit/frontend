const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

type RequestOptions = RequestInit & { token?: string | null };

export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const token =
    options.token ??
    (typeof window === "undefined"
      ? null
      : window.sessionStorage.getItem("ipaim-token"));
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body)
    headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const payload = (await response.json().catch(() => null)) as {
    message?: string | string[];
  } | null;
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined")
      window.dispatchEvent(new Event("ipaim-session-expired"));
    const message = Array.isArray(payload?.message)
      ? payload.message.join(", ")
      : payload?.message;
    throw new Error(message || "Une erreur est survenue avec le serveur.");
  }
  return payload as T;
}

export function notifySessionChanged() {
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("ipaim-session"));
}

export async function login(email: string, motDePasse: string) {
  return apiFetch<{
    access_token: string;
    utilisateur: import("./types").User;
  }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, motDePasse }),
    token: null,
  });
}
