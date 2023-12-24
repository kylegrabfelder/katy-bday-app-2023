import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { API } from 'aws-amplify';
import { AddGiftDialog } from './dialogs/add-gift/add-gift.component';
import { RequestLoanDialog } from './dialogs/request-loan/request-loan.component';
import { AuthenticatorService } from '@aws-amplify/ui-angular';

interface Loan {
  id: string;
  value: number;
  createTime: string;
  paidOff: boolean;
  paidOffTime?: string;
}

interface Gift {
  id: string;
  value: number;
  createTime: string;
  redeemed: boolean;
  redemptionTime?: string;
}

interface Stats {
  gifted: number,
  redeemable: number,
  lent: number,
  debt: number
}

interface Ledger {
  loans: Loan[],
  gifts: Gift[],
  stats: Stats
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'amplify-app';

  public ledger: Ledger | undefined;

  public unpaidLoans: number = 0;
  public unredeemedGifts: number = 0;

  public isSuperUser: boolean = false;

  constructor(
    private _snackBar: MatSnackBar,
    private _dialog: MatDialog,
    private _authenticator: AuthenticatorService
  ) {
    this._authenticator.subscribe((state) => {
      this.isSuperUser = state?.user?.attributes?.email === 'kylegrabfelder@gmail.com';
    })
  }

  ngOnInit(): void {
    this._loadLedger();
  }

  private _loadLedger(reset: boolean = false): void {
    if (reset) {
      this.ledger = undefined;
    }

    API.get('loanApi', '/ledger', {})
      .then((x: Ledger) => {
        this.ledger = x;

        this.unpaidLoans = x.loans.filter((y) => !y.paidOff).length;
        this.unredeemedGifts = x.gifts.filter((y) => !y.redeemed).length;
      })
      .catch((err) => console.log(err));
  }

  addGift() {
    const dialogRef = this._dialog.open(AddGiftDialog, {});

    dialogRef.afterClosed().subscribe((success) => {
      if (success) {
        this._loadLedger(true);
      }
    });
  }

  requestLoan() {
    const dialogRef = this._dialog.open(RequestLoanDialog, {});

    dialogRef.afterClosed().subscribe((success) => {
      if (success) {
        this._loadLedger(true);
      }
    });
  }

  onPayOff(id: string): void {
    API.patch('loanApi', `/loans/${id}`, {})
      .then((x) => {
        this._snackBar.open('Loan Paid Off!', 'x', { duration: 5000 });
      })
      .catch((err) => {
        this._snackBar.open('There was an issue paying off the loan', 'x', { duration: 5000 });
      })
      .finally(() => {
        this._loadLedger();
      });
  }

  onRedeem(id: string): void {
    API.patch('loanApi', `/gifts/${id}`, {})
      .then((x) => {
        this._snackBar.open('Gift Redeemed!', 'x', { duration: 5000 });
      })
      .catch((err) => {
        this._snackBar.open('There was an issue redeeming the gift', 'x', { duration: 5000 });
      })
      .finally(() => {
        this._loadLedger();
      });
  }
}
