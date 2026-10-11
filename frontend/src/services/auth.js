import { apiFetch } from "./api";

export async function login(credentials) {
  const data = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials)
  });
  localStorage.setItem("access_token", data.token);
  return data;
}

export function logout() {
  localStorage.removeItem("access_token");
}
