import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {MatInputModule} from '@angular/material/input';
import {MatFormFieldModule} from '@angular/material/form-field';
import { API } from 'aws-amplify';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'add-gift',
  templateUrl: 'add-gift.component.html',
  styleUrls: ['add-gift.component.scss'],
  standalone: true,
  imports: [
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
    MatButtonModule
  ]
})
export class AddGiftDialog {
  public giftValue: number | undefined;

  constructor(
    public dialogRef: MatDialogRef<AddGiftDialog>,
    private _snackBar: MatSnackBar,
    @Inject(MAT_DIALOG_DATA) public data: {}
  ) {}

  public onSave() {
    API.post('loanApi', '/gifts', {
      body: { 
        value: this.giftValue
      }
    })
      .then(() => {
        this._snackBar.open('Gift Added', 'x', { duration: 5000 });
        this.onClose(true);
      })
      .catch((err) => {
        console.log(err);
        this._snackBar.open('There was an issue adding the gift', 'x', { duration: 5000 });
        this.onClose(false);
      });
  }

  public onClose(success: boolean) {
    this.dialogRef.close(success);
  }
}