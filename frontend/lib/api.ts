const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.API_BASE_URL || "http://localhost:8787";

type RegisterInput = {
  name: string;
  email: string;
  password: string;
};

type RegisterResponse = {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  project?: {
    id: string;
    name: string;
    region: string;
  };
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });
  } catch {
    throw new Error("Backend недоступен. Проверьте API URL");
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = typeof payload.error === "string" ? payload.error : "Не удалось выполнить запрос.";
    throw new Error(message);
  }

  return payload as T;
}

export function registerUser(input: RegisterInput) {
  return request<RegisterResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input)
  });
}
