// El hash de la clave nunca sale del backend, ni siquiera hacia la propia
// app de escritorio. Prisma 5 todavía no tiene `omit`, así que se recorta acá
// en un solo lugar en vez de repetir un `select` gigante en cada consulta.
export function sinClave<T extends { passwordHash?: unknown }>(u: T): Omit<T, 'passwordHash'> {
  const { passwordHash: _descartado, ...resto } = u;
  return resto;
}
