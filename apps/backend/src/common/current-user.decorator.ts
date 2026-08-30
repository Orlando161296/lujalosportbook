import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// TODO: hoy es un stub — asume que un AuthGuard (pendiente de implementar,
// ver stack técnico: "sesión local simple / JWT sin refresh") ya dejó
// `req.user` seteado. Ningún módulo de recurso debería asumir más que esto.
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return req.user ?? { id: 1 }; // fallback de desarrollo mientras no hay auth real
});
