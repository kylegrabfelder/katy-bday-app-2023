import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'timePipe'
})
export class TimePipePipe implements PipeTransform {

  transform(value?: string): string {
    return value?.split('T')[0] ?? '';
  }

}
