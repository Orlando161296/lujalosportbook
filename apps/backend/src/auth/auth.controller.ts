import { Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { sinClave } from '../common/sin-clave';

class LoginDto {
  @IsString() usuario: string;
  @IsString() @MinLength(1) clave: string;
  // La taquilla se elige al entrar, no en preferencias: el mismo equipo rota
  // de puesto y cada jugada queda marcada con el puesto que la registró.
  @IsOptional() @IsInt() taquillaId?: number;
}

// TODO: esto sigue siendo un esqueleto. Falta decidir e implementar el
// mecanismo real (sesión local simple vs JWT sin refresh — ver stack técnico,
// se descartó JWT+refresh por ser más de lo necesario para una app 100% local).
// Hoy no compara la clave ni emite sesión.
@Controller('auth')
export class AuthController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { usuario: dto.usuario },
      include: { taquilla: true },
    });
    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Usuario o contraseña inválidos');
    }

    // TODO: comparar dto.clave contra usuario.passwordHash con bcrypt.
    // TODO: emitir sesión y setear req.user en un guard real (ver
    // src/common/current-user.decorator.ts, hoy usa un fallback de desarrollo).

    if (dto.taquillaId != null && dto.taquillaId !== usuario.taquillaId) {
      // Ocupar otro puesto es normal: se registra para que las jugadas de esta
      // sesión salgan con la taquilla correcta.
      await this.prisma.usuario.update({
        where: { id: usuario.id },
        data: { taquillaId: dto.taquillaId },
      });
      usuario.taquillaId = dto.taquillaId;
    }

    return { usuario: sinClave(usuario) };
  }

  @Post('logout')
  logout() {
    return { ok: true };
  }
}
