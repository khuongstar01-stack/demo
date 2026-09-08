(function (factory) {
  const config = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = config;
  }

  if (typeof window !== "undefined") {
    window.VOUCHER_CONFIG = config;
  }
})(function () {
  const vouchers = [
    {
      slot: 1,
      channel: "fb22",
      defaultName: "Voucher FB 22%",
      apiLabel: "Mã FB 22%",
      subtitle: "(Giảm tối đa 500k)",
      theme: "fb",
      nameKey: "voucherName1",
      visibilityKey: "showVoucherFb22",
      badgeKey: "voucherBadgeFb22",
      defaultBadge: "⚡ 0H 9H 15H 20H CÓ MÃ"
    },
    {
      slot: 2,
      channel: "ig22",
      defaultName: "Voucher IG 22%",
      apiLabel: "Mã IG 22%",
      subtitle: "(Giảm tối đa 300k)",
      theme: "ig",
      nameKey: "voucherName2",
      visibilityKey: "showVoucherIg22",
      badgeKey: "voucherBadgeIg22",
      defaultBadge: "⚡ 0H 9H 15H 20H CÓ MÃ"
    },
    {
      slot: 3,
      channel: "fb20",
      defaultName: "Voucher FB 20%",
      apiLabel: "Mã FB 20%",
      subtitle: "(Giảm tối đa 300k)",
      theme: "fb",
      nameKey: "voucherName3",
      visibilityKey: "showVoucherFb20",
      badgeKey: "voucherBadgeFb20",
      defaultBadge: "⚡ CÓ MÃ"
    },
    {
      slot: 4,
      channel: "zalo25",
      defaultName: "Voucher Zalo 25%",
      apiLabel: "Mã Zalo 25%",
      subtitle: "",
      theme: "zalo",
      nameKey: "voucherName4",
      visibilityKey: "showVoucherZalo25",
      badgeKey: "voucherBadgeZalo25",
      defaultBadge: "Đơn tối thiểu 200k"
    }
  ];

  return Object.freeze(vouchers.map((voucher) => Object.freeze(voucher)));
});
