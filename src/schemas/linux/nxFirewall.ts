import { ResourceSchema } from '../../types';

export const nxFirewallSchema: ResourceSchema = {
  resourceName: 'nxFirewall',
  moduleName: 'nxtools',
  moduleVersion: '1.6.0',
  mofClassName: 'nxFirewall',
  dscV3TypeName: 'nxtools/nxFirewall',
  platform: 'Linux',
  description: 'Manage Linux firewall rules (iptables/nftables/firewalld)',
  docUrl: 'https://github.com/Azure/nxtools#readme',
  category: 'Networking',
  properties: [
    { name: 'Name', description: 'Firewall rule name', type: 'string', required: true, isKey: true, placeholder: 'allow-ssh' },
    { name: 'Port', description: 'Port number', type: 'integer', required: true, isKey: false, placeholder: '22' },
    { name: 'Protocol', description: 'Network protocol', type: 'string', required: false, isKey: false, enumValues: ['tcp', 'udp', 'icmp'], defaultValue: 'tcp' },
    { name: 'Action', description: 'Allow or deny traffic', type: 'string', required: true, isKey: false, enumValues: ['Allow', 'Deny'], defaultValue: 'Allow' },
    { name: 'Direction', description: 'Traffic direction', type: 'string', required: false, isKey: false, enumValues: ['Inbound', 'Outbound'], defaultValue: 'Inbound' },
    { name: 'Source', description: 'Source IP/CIDR', type: 'string', required: false, isKey: false, placeholder: '0.0.0.0/0' },
    { name: 'Ensure', description: 'Whether the rule should exist', type: 'string', required: false, isKey: false, enumValues: ['Present', 'Absent'], defaultValue: 'Present' },
  ],
};
