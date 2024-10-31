import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ async: false })
export class StrongerPasswordConstraint
  implements ValidatorConstraintInterface
{
  validate(password: string, args: ValidationArguments) {
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const hasNonAlphas = /[\W_]/.test(password);
    return hasUpperCase && hasLowerCase && hasNumbers && hasNonAlphas;
  }

  defaultMessage(args: ValidationArguments) {
    return 'A senha é muito fraca! Deve conter letras maiúsculas e minúsculas, números e caracteres especiais.';
  }
}

export function IsStrongerPassword(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: StrongerPasswordConstraint,
    });
  };
}
