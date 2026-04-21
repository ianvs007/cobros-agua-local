import { describe, it, expect } from 'vitest';
import { numeroALetras } from '../letras';

describe('numeroALetras utility', () => {
    it('debería retornar "CERO 00/100 BOLIVIANOS" para null, undefined o NaN', () => {
        expect(numeroALetras(null)).toBe('CERO 00/100 BOLIVIANOS');
        expect(numeroALetras(undefined)).toBe('CERO 00/100 BOLIVIANOS');
        expect(numeroALetras(NaN)).toBe('CERO 00/100 BOLIVIANOS');
    });

    it('debería formatear correctamente el valor "0"', () => {
        expect(numeroALetras(0)).toBe('CERO 00/100 BOLIVIANOS');
    });

    it('debería manejar enteros de un dígito correctamente', () => {
        expect(numeroALetras(1)).toBe('UN 00/100 BOLIVIANOS');
        expect(numeroALetras(5)).toBe('CINCO 00/100 BOLIVIANOS');
        expect(numeroALetras(9)).toBe('NUEVE 00/100 BOLIVIANOS');
    });

    it('debería mapear los casos especiales entre 11 y 29', () => {
        expect(numeroALetras(11)).toBe('ONCE 00/100 BOLIVIANOS');
        expect(numeroALetras(15)).toBe('QUINCE 00/100 BOLIVIANOS');
        expect(numeroALetras(21)).toBe('VEINTIUNO 00/100 BOLIVIANOS');
        expect(numeroALetras(29)).toBe('VEINTINUEVE 00/100 BOLIVIANOS');
    });

    it('debería manejar decenas y restos', () => {
        expect(numeroALetras(30)).toBe('TREINTA 00/100 BOLIVIANOS');
        expect(numeroALetras(45)).toBe('CUARENTA Y CINCO 00/100 BOLIVIANOS');
        expect(numeroALetras(99)).toBe('NOVENTA Y NUEVE 00/100 BOLIVIANOS');
    });

    it('debería manejar centenas', () => {
        expect(numeroALetras(100)).toBe('CIEN 00/100 BOLIVIANOS');
        expect(numeroALetras(101)).toBe('CIENTO UN 00/100 BOLIVIANOS');
        expect(numeroALetras(555)).toBe('QUINIENTOS CINCUENTA Y CINCO 00/100 BOLIVIANOS');
    });

    it('debería manejar miles', () => {
        expect(numeroALetras(1000)).toBe('MIL 00/100 BOLIVIANOS');
        expect(numeroALetras(1001)).toBe('MIL UN 00/100 BOLIVIANOS');
        expect(numeroALetras(2345)).toBe('DOS MIL TRESCIENTOS CUARENTA Y CINCO 00/100 BOLIVIANOS');
    });

    it('debería redondear y formatear correctamente los centavos', () => {
        expect(numeroALetras(10.50)).toBe('DIEZ 50/100 BOLIVIANOS');
        expect(numeroALetras(10.05)).toBe('DIEZ 05/100 BOLIVIANOS');
        expect(numeroALetras(10.99)).toBe('DIEZ 99/100 BOLIVIANOS');
        // Redondeo hacia arriba: 10.999 -> 11
        expect(numeroALetras(10.999)).toBe('ONCE 00/100 BOLIVIANOS');
    });
});
