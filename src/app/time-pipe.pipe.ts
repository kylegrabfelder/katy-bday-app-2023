import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'timePipe'
})
export class TimePipePipe implements PipeTransform {

  transform(value?: string): string {
    if (!value) {
      return '';
    }

    const d = new Date(value);
    return d.toLocaleDateString();
  }

}
