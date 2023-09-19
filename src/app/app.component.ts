import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { API } from 'aws-amplify';

interface Loan {
  id: string;
  value: number;
  redeemed: boolean;
  redemptionTime?: string;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'amplify-app';

  public loans: Loan[] = [];

  constructor(
    private _snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this._loadLoans();
  }

  private _loadLoans(): void {
    API.get('loanApi', '/loans', {})
      .then((x) => {
        this.loans = x.items;
      })
      .catch((err) => console.log(err));
  }

  onRedeem(id: string): void {
    this.loans = [];
    API.patch('loanApi', `/loans/${id}`, {})
      .then((x) => {
        this._snackBar.open('Loan Redeemed!');
      })
      .catch((err) => {
        this._snackBar.open('There was an issue redeeming the loan!');
      })
      .finally(() => {
        this._loadLoans();
      })
  }
}
